// app.config.js — dynamic config so EAS Secrets can be injected at build time.
// Run:  eas secret:create --scope project --name OPENAI_API_KEY --value sk-...

export default {
  expo: {
    name: 'Finite Social',
    slug: 'finite-social',
    scheme: 'finitesocial',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',

    // "automatic" lets the user's system preference control the colour scheme,
    // which is correct since the app ships its own theme switcher.
    userInterfaceStyle: 'automatic',

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0A0F',
    },

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.finitesocial.app',
    },

    android: {
      package: 'com.finitesocial.app',
      // Edge-to-edge (Android 15+)
      edgeToEdgeLayoutEnabled: true,
      adaptiveIcon: {
        backgroundColor: '#0A0A0F',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage:  './assets/android-icon-monochrome.png',
      },
      // Disable predictive back so the swipe gesture doesn't close the app
      // from mid-feed — users swipe vertically, not horizontally.
      predictiveBackGestureEnabled: false,
    },

    web: {
      favicon: './assets/favicon.png',
    },

    plugins: [
      'expo-router',
      'expo-web-browser',
      [
        'expo-splash-screen',
        {
          // Keeps the splash visible until the app is fully ready.
          // Fixes the white-flash on Android 12+ cold starts.
          backgroundColor: '#0A0A0F',
          image: './assets/splash-icon.png',
          imageWidth: 200,
        },
      ],
    ],

    extra: {
      supabaseUrl:  process.env.EXPO_PUBLIC_SUPABASE_URL  ?? 'https://thcvuehyblejxetazvia.supabase.co',
      supabaseAnon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoY3Z1ZWh5YmxlanhldGF6dmlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTQ0ODAsImV4cCI6MjA4OTI5MDQ4MH0.6flJSrhPrJzRyOf9zTDrFem-4JWpR0yViBY6XnUdWhE',
      eas: {
        projectId: '5892e87f-2fe6-440c-b0e1-46ac4136a441',
      },
    },
  },
};
