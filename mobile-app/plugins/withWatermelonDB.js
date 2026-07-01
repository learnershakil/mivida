const { withAppBuildGradle } = require('@expo/config-plugins');

const withWatermelonDB = (config) => {
    return withAppBuildGradle(config, (config) => {
        const buildGradle = config.modResults.contents;

        // Fixes libc++_shared.so conflicts common with Reanimated + WatermelonDB
        const packagingOptions = `
    packagingOptions {
        pickFirst 'lib/x86/libc++_shared.so'
        pickFirst 'lib/x86_64/libc++_shared.so'
        pickFirst 'lib/armeabi-v7a/libc++_shared.so'
        pickFirst 'lib/arm64-v8a/libc++_shared.so'
    }
    `;

        if (!buildGradle.includes("pickFirst 'lib/x86/libc++_shared.so'")) {
            config.modResults.contents = buildGradle.replace(
                /android\s*{/,
                `android {
        ${packagingOptions}`
            );
        }

        return config;
    });
};

module.exports = withWatermelonDB;