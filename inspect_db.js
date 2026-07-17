import prisma from './src/config/db.js';

async function main() {
  try {
    const settings = await prisma.userSettings.findMany();
    console.log('--- ALL USER SETTINGS ---');
    for (const setting of settings) {
      console.log(`User ID: ${setting.userId}`);
      console.log('Session Preferences:', JSON.stringify(setting.sessionPreferences, null, 2));
    }
  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
