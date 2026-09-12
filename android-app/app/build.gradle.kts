import java.util.Properties

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

val signingProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
android { namespace = "com.retzef.app"; compileSdk = 36
    defaultConfig { applicationId = "com.retzef.app"; minSdk = 26; targetSdk = 36; versionCode = 1; versionName = "1.0.0" }
    signingConfigs { create("release") { if (signingProperties.containsKey("storeFile")) { storeFile = rootProject.file(signingProperties["storeFile"] as String); storePassword = signingProperties["storePassword"] as String; keyAlias = signingProperties["keyAlias"] as String; keyPassword = signingProperties["keyPassword"] as String } } }
    buildTypes { release { signingConfig = signingConfigs.getByName("release"); isMinifyEnabled = false; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}

dependencies { implementation("androidx.core:core-ktx:1.15.0"); implementation("androidx.appcompat:appcompat:1.7.0"); implementation("androidx.activity:activity-ktx:1.10.1"); implementation("com.google.android.material:material:1.12.0") }
