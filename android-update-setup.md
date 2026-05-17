# Android App Private Update Setup

This document outlines how the secure, private update system works for the Android application and provides instructions on how to release new updates.

## 1. Set Up the Private Storage Bucket
1. Open your **Supabase Dashboard** and navigate to **Storage**.
2. Create a new bucket and name it exactly **`app-updates`**.
3. **Crucial:** Make sure this bucket is **Private** (do not make it Public). 
4. Upload your new APK file to this bucket (for example, `dcel-office-suite-1.5.3.apk`).

## 2. Update your `version.json` file
In the `version.json` file that is hosted on your webserver (e.g. `dewaterconstruct.com/app-updates/version.json`), change the `url` field to simply be the filename of the APK you uploaded to Supabase, rather than a full HTTP link. 

For example:
```json
{
  "version": "1.5.3",
  "url": "dcel-office-suite-1.5.3.apk",
  "notes": "Bug fixes and performance improvements."
}
```

## 3. How the Secure Handshake Works
1. Your Android app silently checks your webserver for the `version.json` file.
2. If it detects a newer version (e.g., `1.5.3` is greater than `1.5.1`), it shows the Update button in the app's sidebar.
3. When the user clicks "Download & Install", the app looks at the `url` string. Because it doesn't start with `http` (it's just a filename), the app realizes it needs to fetch it securely.
4. The app uses its internal, authenticated connection to Supabase to request a **Signed URL** for `dcel-office-suite-1.5.3.apk`. 
5. Supabase verifies the request and responds with a massive, cryptographic link that is only valid for **60 seconds**.
6. The app instantly forces the Android device to download from that temporary link.

### Security Benefits
This guarantees that **only users who have the app installed** and click the button can download the update. If a random person or scraper finds your webserver's `version.json` file, all they will see is a filename. They will not have the Supabase permissions required to generate the secure download link.
