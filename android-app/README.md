# רצף — Android

פרויקט Android native ב-Kotlin עם Gradle, Target SDK 36 ו-WebView מותאם מובייל. האפליקציה טוענת את האתר הקיים מ-`https://chi-liart-74.vercel.app/`, ולכן TikTok OAuth, Vercel APIs, Redis, PayPal, לוחות והצ׳אט נשארים בצד השרת ולא משוכפלים באפליקציה.

## בנייה

פתחו את התיקייה `android-app` ב-Android Studio, התקינו Android SDK Platform 36 ו-Build Tools, ובנו:

```bash
./gradlew bundleRelease
```

הקובץ יופיע תחת `app/build/outputs/bundle/release/`.

לפני פרסום ב-Google Play יש ליצור חתימת upload אמיתית של בעל החשבון, להגדיר אותה ב-`keystore.properties` מקומי שלא נכנס ל-Git, ולהשלים פרטי Data Safety, Privacy Policy, screenshots, אייקון, content rating וחשבון Play Console.
