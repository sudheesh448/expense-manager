🔧 Option 1: Local EAS Build (Free, No Cloud Limit)
This uses your own machine's resources instead of Expo's cloud servers.

bash
eas build -p android --profile preview --local

🔧 Option 2: Plain React Native Build (No EAS at all)
Since your app uses Expo, you can eject to bare workflow and build using Gradle directly:

bash
# 1. Generate native project files
npx expo prebuild --platform android
# 2. Build debug APK (instant, no signing needed)
cd android && ./gradlew assembleDebug
# APK lands at:
# android/app/build/outputs/apk/debug/app-debug.apk

🔧 Option 3: GitHub Actions (Free CI/CD)
You can push your code to GitHub and use GitHub Actions (2,000 free minutes/month) to build the APK automatically every time you push.

My Recommendation
Go with Option 2 — npx expo prebuild + Gradle. It's the fastest, completely offline, and produces an APK you can sideload immediately.

Do you want me to walk you through setting it up? I can also check if your current app.json is already configured correctly for prebuild.



eas login


eas build:configure

eas build -p android --profile preview
