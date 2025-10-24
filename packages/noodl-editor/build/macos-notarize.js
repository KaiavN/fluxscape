const fs = require('fs');
const path = require('path');

module.exports = async function (params) {
  if (process.platform !== 'darwin') {
    return;
  }

  // Validate required environment variables
  const appleId = process.env.appleId;
  const appleIdPassword = process.env.appleIdPassword;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleIdPassword) {
    console.log('apple password not set, skipping notarization');
    return;
  }

  if (!appleId) {
    console.log('apple ID not set, skipping notarization');
    return;
  }

  const appId = 'fluxscape.net.fluxscape';

  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }

  console.log(`Notarizing ${appId} found at ${appPath}`);

  try {
    const { notarize } = require('@electron/notarize');
    
    const notarizeOptions = {
      appBundleId: appId,
      appPath: appPath,
      appleId: appleId,
      appleIdPassword: appleIdPassword
    };

    // Add teamId if provided (recommended for accounts with multiple teams)
    if (teamId) {
      notarizeOptions.teamId = teamId;
      console.log(`Using team ID: ${teamId}`);
    }

    await notarize(notarizeOptions);
  } catch (error) {
    const errorMessage = error.message || error.toString();
    
    console.error('Notarization failed:');
    
    if (errorMessage.includes('authentication') || errorMessage.includes('credentials') || errorMessage.includes('password')) {
      console.error('  - Invalid Apple ID credentials');
      console.error('  - Ensure you are using an app-specific password (not your regular Apple ID password)');
      console.error('  - Check that your Apple Developer account is active');
    } else if (errorMessage.includes('team')) {
      console.error('  - Team ID issue detected');
      console.error('  - If you belong to multiple teams, set APPLE_TEAM_ID environment variable');
      console.error('  - Find your team ID at: https://developer.apple.com/account');
    } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      console.error('  - Network or timeout issue');
      console.error('  - Apple notarization service may be slow or down');
      console.error('  - Check status: https://developer.apple.com/system-status/');
      console.error('  - Try building again');
    } else {
      console.error('  - Error details:', errorMessage);
    }
    
    console.error('\nBuild will continue, but app is not notarized.');
    console.error('Users may see "damaged app" warnings. See docs/MACOS_SIGNING.md for details.\n');
    
    // Don't fail the build - just log the error
    return;
  }

  console.log(`Done notarizing ${appId}`);
};
