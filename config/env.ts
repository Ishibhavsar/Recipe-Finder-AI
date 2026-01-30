/**
 * Environment configuration and validation
 * Ensures all required environment variables are present before the app starts
 */

interface Config {
  geminiApiKey: string;
  unsplashAccessKey: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Validates and retrieves environment variables
 * Throws an error if required variables are missing
 */
function validateEnv(): Config {
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const unsplashAccessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

  const missingVars: string[] = [];

  if (!geminiApiKey) {
    missingVars.push('VITE_GEMINI_API_KEY');
  }

  if (!unsplashAccessKey) {
    missingVars.push('VITE_UNSPLASH_ACCESS_KEY');
  }

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missingVars.map((v) => `  - ${v}`).join('\n')}\n\n` +
        'Please create a .env file in the project root with these variables.\n' +
        'See .env.example for reference.'
    );
  }

  return {
    geminiApiKey,
    unsplashAccessKey,
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

// Validate environment on module load
export const config = validateEnv();

// Helper to check if we're in development mode
export const isDev = () => config.isDevelopment;

// Helper to log only in development
export const devLog = (...args: unknown[]) => {
  if (config.isDevelopment) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

// Helper to log errors (always logs, but with more detail in dev)
export const logError = (message: string, error?: unknown) => {
  if (config.isDevelopment) {
    console.error(`[Error] ${message}`, error);
  } else {
    console.error(`[Error] ${message}`);
  }
};
