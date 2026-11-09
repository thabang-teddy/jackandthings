plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// The release version comes from CI so the APK and the git tag agree; a local
// build falls back to the values below. The release job reads the versionName
// default off this line, so the literal lives here and nowhere else.
val jackVersionName = (findProperty("jackVersionName") as String?) ?: "0.1.0"
val jackVersionCode = (findProperty("jackVersionCode") as String?)?.toIntOrNull() ?: 1

// ── Release signing ────────────────────────────────────────────────────────
//
// The keystore and its passwords come from the environment, never from the
// repository and never from gradle.properties. CI writes the keystore out of a
// secret before building; see the `apk` job in .github/workflows/ci.yml, and
// docs/DEPLOYMENT.md for the one-time keytool command.
//
// Every published APK must be signed with the SAME key. Android refuses to
// install an update signed with a different one, and a per-runner debug
// keystore is generated fresh on every build — so a debug-signed download
// installs once and can never be upgraded. A local release build is still
// allowed to fall back to debug keys (it must be buildable without the
// secret), but anything that will be handed out passes
// -PjackRequireSigning=true and fails loudly instead.
val jackRequireSigning = (findProperty("jackRequireSigning") as String?).toBoolean()

val jackSigning: Map<String, String>? = run {
    val values = listOf(
        "JACK_KEYSTORE_FILE",
        "JACK_KEYSTORE_PASSWORD",
        "JACK_KEY_ALIAS",
        "JACK_KEY_PASSWORD",
    ).associateWith { System.getenv(it).orEmpty() }

    val missing = values.filterValues { it.isBlank() }.keys
    val keystore = values.getValue("JACK_KEYSTORE_FILE")
        .takeIf { it.isNotBlank() }
        ?.let { file(it) }

    when {
        missing.isEmpty() && keystore?.exists() == true -> values

        !jackRequireSigning -> null

        missing.isNotEmpty() -> error(
            "Release signing was required but these environment variables are " +
                "unset: ${missing.joinToString(", ")}.",
        )

        else -> error("Release signing was required but no keystore exists at $keystore.")
    }
}

// Overridable from the command line (-PjackApiBaseUrl=...) so a build aimed at
// a real server does not need a source edit. The defaults below are the local
// ones: 10.0.2.2 is how the emulator reaches the host machine's localhost.
val debugApiBaseUrl = (findProperty("jackApiBaseUrl") as String?)
    ?: "http://10.0.2.2:8000/api/v1/"
val releaseApiBaseUrl = (findProperty("jackApiBaseUrl") as String?)
    ?: "https://localhost/api/v1/"

android {
    namespace = "com.jackandthings"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jackandthings"

        // 26 rather than the 21 the sibling client uses: notification channels
        // arrived in 26, and the hourly workout reminder needs one. Keeping the
        // floor here means no version-guarded branch for the one feature that
        // would need it.
        minSdk = 26
        targetSdk = 36
        versionCode = jackVersionCode
        versionName = jackVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Only created when the environment supplies a complete, existing keystore.
    // With -PjackRequireSigning=true the block above has already thrown rather
    // than reaching this point without one.
    signingConfigs {
        jackSigning?.let { values ->
            create("release") {
                storeFile = file(values.getValue("JACK_KEYSTORE_FILE"))
                storePassword = values.getValue("JACK_KEYSTORE_PASSWORD")
                keyAlias = values.getValue("JACK_KEY_ALIAS")
                keyPassword = values.getValue("JACK_KEY_PASSWORD")

                // v1 as well as v2/v3. Not for compatibility — minSdk is 26 and
                // the platform accepts v2 — but so `keytool -printcert -jarfile`
                // can read the certificate. The release job uses that to prove
                // a debug key never reached a published APK, and keytool only
                // understands the JAR (v1) signature. Without this the check
                // fails with "Not a signed jar file", which is the wrong reason
                // to block a release.
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")

            // The real key when the environment supplies one, debug keys when
            // it does not — and with -PjackRequireSigning=true the build has
            // already failed above rather than reaching this fallback.
            signingConfig = signingConfigs.findByName("release")
                ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.security.crypto)
    implementation(libs.androidx.work.runtime)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}
