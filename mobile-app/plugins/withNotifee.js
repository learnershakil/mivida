const { withProjectBuildGradle } = require('@expo/config-plugins');

const withNotifee = (config) => {
  return withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;

    // Add the Notifee local maven repository
    const notifeeMaven = `
        maven {
            url "$rootDir/../node_modules/@notifee/react-native/android/libs"
        }
    `;

    if (!buildGradle.includes("node_modules/@notifee/react-native/android/libs")) {
      config.modResults.contents = buildGradle.replace(
        /allprojects\s*{\s*repositories\s*{/,
        `allprojects {
            repositories {
                ${notifeeMaven}`
      );
    }

    return config;
  });
};

module.exports = withNotifee;