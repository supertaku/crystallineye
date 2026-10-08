const { withAppBuildGradle } = require('@expo/config-plugins');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

// CMake needs a short staging folder as well as hashed source paths on Windows.
module.exports = function withWindowsCmake(config) {
  if (process.platform !== 'win32') return config;
  return withAppBuildGradle(config, (result) => {
    const ninja = join(result.modRequest.projectRoot, '.build-tools', 'ninja.exe').replace(/\\/g, '/');
    const ninjaArgument = existsSync(ninja) ? `, "-DCMAKE_MAKE_PROGRAM=${ninja}"` : '';
    const staging = process.env.CRYSTALLINEYE_CMAKE_STAGING?.replace(/\\/g, '/');
    const marker = '// Crystallineye Windows object-path limit';
    if (!result.modResults.contents.includes(marker)) {
      result.modResults.contents = result.modResults.contents.replace(/defaultConfig\s*\{/, `defaultConfig {
        ${marker}
        externalNativeBuild { cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=250"${ninjaArgument} } }`);
      if (staging) result.modResults.contents = result.modResults.contents.replace(/android\s*\{/, `android {
    externalNativeBuild { cmake { buildStagingDirectory file("${staging}") } }`);
    }
    return result;
  });
};
