/**
 * Programmatic Bubblewrap build — generates the signed Android app bundle for Farm OS.
 *
 * Run: node scripts/build-apk.mjs
 *
 * Needs these environment variables (keep them out of the repo, e.g. in .env.android.local):
 *   JAVA_HOME          JDK 17+ install folder
 *   ANDROID_HOME       Android SDK folder
 *   KEYSTORE_PASSWORD  password for android.keystore (the keystore itself is git-ignored)
 *   KEY_PASSWORD       password for the signing key (often the same as KEYSTORE_PASSWORD)
 *   KEY_ALIAS          optional, defaults to "android"
 */
import { TwaManifest, Config, TwaGenerator, JdkHelper, AndroidSdkTools, ConsoleLog } from "@bubblewrap/core";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "android-build");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See the comment at the top of scripts/build-apk.mjs.`);
    process.exit(1);
  }
  return value;
}

const JDK = requireEnv("JAVA_HOME");
const SDK = process.env.ANDROID_HOME || requireEnv("ANDROID_SDK_ROOT");

const KEYSTORE = path.join(ROOT, "android.keystore");
const KEYSTORE_PASSWORD = requireEnv("KEYSTORE_PASSWORD");
const KEY_ALIAS = process.env.KEY_ALIAS || "android";
const KEY_PASSWORD = process.env.KEY_PASSWORD || KEYSTORE_PASSWORD;

const log = new ConsoleLog(false);

async function main() {
  console.log("▶ Loading TWA manifest...");
  const twaManifestPath = path.join(ROOT, "twa-manifest.json");
  const manifest = await TwaManifest.fromFile(twaManifestPath);

  // Inject signing config into manifest
  manifest.signingKey = {
    path: KEYSTORE,
    alias: KEY_ALIAS,
  };
  manifest.storePassword = KEYSTORE_PASSWORD;
  manifest.keyPassword = KEY_PASSWORD;

  console.log("▶ Setting up Config...");
  const config = new Config(JDK, SDK);

  console.log("▶ Setting up JDK / Android SDK tools...");
  const jdkHelper = new JdkHelper(ROOT, config);
  const androidSdkTools = await AndroidSdkTools.create(ROOT, config, jdkHelper, log);

  console.log("▶ Generating TWA project at", OUT, "...");
  const generator = new TwaGenerator();
  await generator.createTwaProject(OUT, manifest, log);

  console.log("▶ Building signed APK / AAB — this takes 2-5 minutes...");
  void androidSdkTools; // set up above so Bubblewrap installs any missing SDK pieces

  // Build via the gradle wrapper inside the generated project
  const { execSync } = await import("child_process");
  const env = {
    ...process.env,
    ANDROID_HOME: SDK,
    ANDROID_SDK_ROOT: SDK,
    JAVA_HOME: JDK,
  };

  const gradlew = path.join(OUT, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  console.log("▶ Running Gradle...");
  execSync(`"${gradlew}" bundleRelease`, {
    cwd: OUT,
    env,
    stdio: "inherit",
    shell: true,
  });

  const aabPath = path.join(OUT, "app", "build", "outputs", "bundle", "release", "app-release.aab");
  const destAab = path.join(ROOT, "Farm-OS-v1.0.0.aab");

  if (fs.existsSync(aabPath)) {
    fs.copyFileSync(aabPath, destAab);
    console.log("\n✅ Build complete!");
    console.log("   AAB (Play Store): " + destAab);
    console.log("\n📋 Next steps:");
    console.log("   1. Upload Farm-OS-v1.0.0.aab to Google Play Console → Internal testing");
    console.log("   2. Note: If Play Console uses Google-managed signing, add Play's SHA-256 to assetlinks.json");
    console.log("   3. See docs/android-playstore-guide.md for the full Play Store checklist");
  } else {
    console.error("❌ AAB not found at expected path:", aabPath);
    console.log("Check android-build/app/build/outputs/ for the actual output.");
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
