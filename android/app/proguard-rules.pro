# kotlinx.serialization relies on generated serializers being reachable by
# name. R8 in full mode will otherwise strip them and the app fails at runtime
# with a missing-serializer error rather than at build time.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# The API response models in this app.
-keep,includedescriptorclasses class com.jackandthings.model.**$$serializer { *; }
-keepclassmembers class com.jackandthings.model.** {
    *** Companion;
}
-keepclasseswithmembers class com.jackandthings.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# OkHttp ships optional references to Conscrypt/BouncyCastle that are not on
# the classpath; without this R8 warns about every one of them.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Guava — pulled in by androidx.security:security-crypto — is annotated with
# Error Prone's annotations, which are compile-time only and never packaged.
# R8 in full mode treats the missing annotation classes as an error, so a
# release build fails until they are named here. Dropping them is safe: nothing
# reads them at runtime.
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.j2objc.annotations.**
-dontwarn org.checkerframework.**
