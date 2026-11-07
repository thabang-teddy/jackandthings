plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
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
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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

            // No release keystore exists yet, so a release build is signed with
            // debug keys and is not distributable. Wire real signing from the
            // environment (as ../../giwubible/kotlin does) before handing an
            // APK to anyone.
            signingConfig = signingConfigs.getByName("debug")
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
