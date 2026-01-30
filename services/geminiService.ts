import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Category, RecipeDetail, RecipeSummary } from '../types';
import { translateSearchQuery, translateRecipeContent } from './translationService';
import { fetchRecipeImage } from './imageService';
import i18n from '../i18n/config';
import { config } from '../config/env';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
const MODEL_NAME = 'gemini-2.5-flash';

// ========================================
// RECIPE CACHE SYSTEM
// ========================================
interface CachedRecipe {
  english: RecipeDetail;
  translations: Map<string, RecipeDetail>;
  timestamp: number;
}

const recipeCache = new Map<string, CachedRecipe>();
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 100; // Limit cache size

// Cache helper functions
const getCacheKey = (recipeName: string): string => recipeName.toLowerCase().trim();

const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_EXPIRY_MS;
};

const evictOldestCache = (): void => {
  if (recipeCache.size < MAX_CACHE_SIZE) return;

  let oldestKey: string | null = null;
  let oldestTime = Date.now();

  for (const [key, value] of recipeCache.entries()) {
    if (value.timestamp < oldestTime) {
      oldestTime = value.timestamp;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    recipeCache.delete(oldestKey);
  }
};

const getCachedRecipe = (recipeName: string, language: string): RecipeDetail | null => {
  const cacheKey = getCacheKey(recipeName);
  const cached = recipeCache.get(cacheKey);

  if (!cached || !isCacheValid(cached.timestamp)) {
    if (cached) recipeCache.delete(cacheKey);
    return null;
  }

  // Return English version if requested
  if (language === 'en') {
    return cached.english;
  }

  // Return cached translation if available
  return cached.translations.get(language) || null;
};

const setCachedRecipe = (
  recipeName: string,
  englishRecipe: RecipeDetail,
  language: string,
  translatedRecipe?: RecipeDetail
): void => {
  evictOldestCache();

  const cacheKey = getCacheKey(recipeName);
  let cached = recipeCache.get(cacheKey);

  if (!cached) {
    cached = {
      english: englishRecipe,
      translations: new Map(),
      timestamp: Date.now(),
    };
    recipeCache.set(cacheKey, cached);
  }

  // Cache translation if provided and not English
  if (translatedRecipe && language !== 'en') {
    cached.translations.set(language, translatedRecipe);
  }

  // Update timestamp
  cached.timestamp = Date.now();
};

export const clearRecipeCache = (): void => {
  recipeCache.clear();
};

export const getRecipeCacheStats = () => ({
  size: recipeCache.size,
  maxSize: MAX_CACHE_SIZE,
  expiryMinutes: CACHE_EXPIRY_MS / 60000,
  entries: Array.from(recipeCache.keys()),
});

/**
 * Get recipe image URL (wrapper for imageService)
 * ALWAYS uses English recipe name for consistent images
 * @deprecated Use useRecipeImage hook in components instead
 */
export const getImageUrl = async (
  recipeName: string,
  width: number = 800,
  height: number = 600
): Promise<string> => {
  // Extract English recipe name (remove suffixes like 'meal', 'category')
  const cleanName = recipeName
    .replace(/meal$/i, '')
    .replace(/category$/i, '')
    .trim();
  return await fetchRecipeImage(cleanName, width, height);
};

// Helper to get emoji for categories/recipes
export const getRecipeEmoji = (seed: string): string => {
  const emojiMap: { [key: string]: string } = {
    // Categories
    italian: '🍝',
    japanese: '🍣',
    mexican: '🌮',
    vegan: '🥗',
    dessert: '🍰',
    indian: '🍛',
    thai: '🍜',
    mediterranean: '🥙',
    // Recipe types
    pizza: '🍕',
    pasta: '🍝',
    sushi: '🍣',
    ramen: '🍜',
    curry: '🍛',
    taco: '🌮',
    burger: '🍔',
    salad: '🥗',
    soup: '🍲',
    noodles: '🍜',
    rice: '🍚',
    chicken: '🍗',
    fish: '🐟',
    cake: '🍰',
    paneer: '🧀',
    biryani: '🍛',
    dosa: '🥞',
    samosa: '🥟',
    tikka: '🍢',
    momos: '🥟',
    manchurian: '🥘',
    dumpling: '🥟',
    cheesecake: '🍰',
    chocolate: '🍫',
    lava: '🌋',
    fruit: '🍓',
    churros: '🍩',
    pancake: '🥞',
    quinoa: '🥗',
    tofu: '🥡',
    lentil: '🫘',
    tempura: '🍤',
    miso: '🍵',
    matcha: '🍵',
    guacamole: '🥑',
    quesadilla: '🌮',
    hummus: '🫔',
    falafel: '🧆',
    greek: '🥙',
  };

  const searchKey = seed.toLowerCase().replace('category', '').replace('meal', '').trim();

  // Try exact match
  if (emojiMap[searchKey]) {
    return emojiMap[searchKey];
  }

  // Try partial match
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (searchKey.includes(key)) {
      return emoji;
    }
  }

  // Default emoji
  return '🍽️';
};

export const fetchCategories = async (): Promise<Category[]> => {
  const t = i18n.t.bind(i18n);

  // Return static categories with translated descriptions
  return [
    { id: 'italian', name: 'Italian', description: t('categoryDescriptions.italian') },
    { id: 'japanese', name: 'Japanese', description: t('categoryDescriptions.japanese') },
    { id: 'mexican', name: 'Mexican', description: t('categoryDescriptions.mexican') },
    { id: 'vegan', name: 'Vegan', description: t('categoryDescriptions.vegan') },
    { id: 'dessert', name: 'Dessert', description: t('categoryDescriptions.dessert') },
    { id: 'indian', name: 'Indian', description: t('categoryDescriptions.indian') },
    { id: 'thai', name: 'Thai', description: t('categoryDescriptions.thai') },
    {
      id: 'mediterranean',
      name: 'Mediterranean',
      description: t('categoryDescriptions.mediterranean'),
    },
  ];
};

export const searchRecipes = async (query: string): Promise<RecipeSummary[]> => {
  // Get current language from i18n
  const currentLang = i18n.language || 'en';

  // Translate search query to English if needed
  let englishQuery = query;
  if (currentLang !== 'en') {
    try {
      englishQuery = await translateSearchQuery(query, currentLang);
      // Translation successful
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to translate search query:', error);
      }
      // Continue with original query if translation fails
    }
  }

  const searchLower = englishQuery.toLowerCase();

  // All available recipes
  const allRecipes: RecipeSummary[] = [
    // Italian
    {
      id: '1',
      name: 'Spaghetti Carbonara',
      category: 'Italian',
      shortDescription: 'Creamy pasta with bacon and eggs',
      prepTime: '20 min',
      calories: '450 kcal',
    },
    {
      id: '2',
      name: 'Margherita Pizza',
      category: 'Italian',
      shortDescription: 'Classic pizza with tomato, mozzarella, and basil',
      prepTime: '30 min',
      calories: '380 kcal',
    },
    {
      id: '3',
      name: 'Lasagna Bolognese',
      category: 'Italian',
      shortDescription: 'Layered pasta with meat sauce and cheese',
      prepTime: '60 min',
      calories: '520 kcal',
    },
    {
      id: '4',
      name: 'Risotto Milanese',
      category: 'Italian',
      shortDescription: 'Creamy saffron rice dish',
      prepTime: '35 min',
      calories: '400 kcal',
    },
    {
      id: '5',
      name: 'Tiramisu',
      category: 'Italian',
      shortDescription: 'Coffee-flavored Italian dessert',
      prepTime: '25 min',
      calories: '340 kcal',
    },
    {
      id: '6',
      name: 'Pesto Pasta',
      category: 'Italian',
      shortDescription: 'Pasta with fresh basil pesto sauce',
      prepTime: '15 min',
      calories: '420 kcal',
    },
    // Japanese
    {
      id: '1',
      name: 'Sushi Rolls',
      category: 'Japanese',
      shortDescription: 'Fresh fish and rice wrapped in seaweed',
      prepTime: '40 min',
      calories: '320 kcal',
    },
    {
      id: '2',
      name: 'Ramen Noodles',
      category: 'Japanese',
      shortDescription: 'Rich broth with noodles and toppings',
      prepTime: '45 min',
      calories: '480 kcal',
    },
    {
      id: '3',
      name: 'Teriyaki Chicken',
      category: 'Japanese',
      shortDescription: 'Glazed chicken with sweet soy sauce',
      prepTime: '25 min',
      calories: '380 kcal',
    },
    {
      id: '4',
      name: 'Tempura',
      category: 'Japanese',
      shortDescription: 'Lightly battered and fried seafood and vegetables',
      prepTime: '30 min',
      calories: '340 kcal',
    },
    {
      id: '5',
      name: 'Miso Soup',
      category: 'Japanese',
      shortDescription: 'Traditional Japanese soup with tofu',
      prepTime: '15 min',
      calories: '120 kcal',
    },
    {
      id: '6',
      name: 'Yakitori',
      category: 'Japanese',
      shortDescription: 'Grilled chicken skewers',
      prepTime: '20 min',
      calories: '280 kcal',
    },
    // Mexican
    {
      id: '1',
      name: 'Beef Tacos',
      category: 'Mexican',
      shortDescription: 'Seasoned beef in soft or crispy shells',
      prepTime: '25 min',
      calories: '380 kcal',
    },
    {
      id: '2',
      name: 'Chicken Quesadilla',
      category: 'Mexican',
      shortDescription: 'Grilled tortilla with cheese and chicken',
      prepTime: '20 min',
      calories: '420 kcal',
    },
    {
      id: '3',
      name: 'Guacamole',
      category: 'Mexican',
      shortDescription: 'Fresh avocado dip with lime and cilantro',
      prepTime: '10 min',
      calories: '180 kcal',
    },
    {
      id: '4',
      name: 'Enchiladas',
      category: 'Mexican',
      shortDescription: 'Rolled tortillas with sauce and filling',
      prepTime: '45 min',
      calories: '480 kcal',
    },
    {
      id: '5',
      name: 'Churros',
      category: 'Mexican',
      shortDescription: 'Fried dough with cinnamon sugar',
      prepTime: '30 min',
      calories: '340 kcal',
    },
    {
      id: '6',
      name: 'Nachos',
      category: 'Mexican',
      shortDescription: 'Crispy tortilla chips with toppings',
      prepTime: '15 min',
      calories: '520 kcal',
    },
    // Indian
    {
      id: '1',
      name: 'Butter Chicken',
      category: 'Indian',
      shortDescription: 'Creamy tomato-based chicken curry',
      prepTime: '45 min',
      calories: '480 kcal',
    },
    {
      id: '2',
      name: 'Chicken Tikka Masala',
      category: 'Indian',
      shortDescription: 'Spiced chicken in tomato cream sauce',
      prepTime: '40 min',
      calories: '450 kcal',
    },
    {
      id: '3',
      name: 'Palak Paneer',
      category: 'Indian',
      shortDescription: 'Spinach curry with cottage cheese',
      prepTime: '30 min',
      calories: '320 kcal',
    },
    {
      id: '4',
      name: 'Biryani',
      category: 'Indian',
      shortDescription: 'Fragrant rice with meat or vegetables',
      prepTime: '60 min',
      calories: '550 kcal',
    },
    {
      id: '5',
      name: 'Dal Makhani',
      category: 'Indian',
      shortDescription: 'Creamy black lentil curry',
      prepTime: '50 min',
      calories: '380 kcal',
    },
    {
      id: '6',
      name: 'Samosas',
      category: 'Indian',
      shortDescription: 'Crispy fried pastries with spiced filling',
      prepTime: '40 min',
      calories: '280 kcal',
    },
    // Thai
    {
      id: '1',
      name: 'Pad Thai',
      category: 'Thai',
      shortDescription: 'Stir-fried rice noodles with tamarind sauce',
      prepTime: '25 min',
      calories: '420 kcal',
    },
    {
      id: '2',
      name: 'Green Curry',
      category: 'Thai',
      shortDescription: 'Spicy coconut curry with vegetables',
      prepTime: '35 min',
      calories: '380 kcal',
    },
    {
      id: '3',
      name: 'Tom Yum Soup',
      category: 'Thai',
      shortDescription: 'Hot and sour Thai soup',
      prepTime: '20 min',
      calories: '180 kcal',
    },
    {
      id: '4',
      name: 'Massaman Curry',
      category: 'Thai',
      shortDescription: 'Rich peanut-based curry',
      prepTime: '45 min',
      calories: '480 kcal',
    },
    {
      id: '5',
      name: 'Som Tam',
      category: 'Thai',
      shortDescription: 'Spicy green papaya salad',
      prepTime: '15 min',
      calories: '150 kcal',
    },
    {
      id: '6',
      name: 'Mango Sticky Rice',
      category: 'Thai',
      shortDescription: 'Sweet coconut rice with fresh mango',
      prepTime: '30 min',
      calories: '320 kcal',
    },
    // Vegan
    {
      id: '1',
      name: 'Quinoa Buddha Bowl',
      category: 'Vegan',
      shortDescription: 'Healthy bowl with quinoa and vegetables',
      prepTime: '25 min',
      calories: '380 kcal',
    },
    {
      id: '2',
      name: 'Lentil Soup',
      category: 'Vegan',
      shortDescription: 'Hearty and nutritious lentil soup',
      prepTime: '40 min',
      calories: '280 kcal',
    },
    {
      id: '3',
      name: 'Vegan Tacos',
      category: 'Vegan',
      shortDescription: 'Plant-based tacos with beans and veggies',
      prepTime: '20 min',
      calories: '320 kcal',
    },
    {
      id: '4',
      name: 'Chickpea Curry',
      category: 'Vegan',
      shortDescription: 'Spiced chickpeas in tomato sauce',
      prepTime: '35 min',
      calories: '360 kcal',
    },
    {
      id: '5',
      name: 'Avocado Toast',
      category: 'Vegan',
      shortDescription: 'Crusty bread with mashed avocado',
      prepTime: '10 min',
      calories: '240 kcal',
    },
    {
      id: '6',
      name: 'Veggie Stir Fry',
      category: 'Vegan',
      shortDescription: 'Colorful vegetables in savory sauce',
      prepTime: '20 min',
      calories: '260 kcal',
    },
    // Dessert
    {
      id: '1',
      name: 'Chocolate Cake',
      category: 'Dessert',
      shortDescription: 'Rich and moist chocolate layer cake',
      prepTime: '60 min',
      calories: '520 kcal',
    },
    {
      id: '2',
      name: 'Cheesecake',
      category: 'Dessert',
      shortDescription: 'Creamy New York style cheesecake',
      prepTime: '90 min',
      calories: '480 kcal',
    },
    {
      id: '3',
      name: 'Apple Pie',
      category: 'Dessert',
      shortDescription: 'Classic American apple pie',
      prepTime: '75 min',
      calories: '420 kcal',
    },
    {
      id: '5',
      name: 'Chocolate Brownies',
      category: 'Dessert',
      shortDescription: 'Fudgy chocolate brownies',
      prepTime: '35 min',
      calories: '340 kcal',
    },
    {
      id: '6',
      name: 'Crème Brûlée',
      category: 'Dessert',
      shortDescription: 'French custard with caramelized sugar',
      prepTime: '50 min',
      calories: '360 kcal',
    },
    // Mediterranean
    {
      id: '1',
      name: 'Greek Salad',
      category: 'Mediterranean',
      shortDescription: 'Fresh vegetables with feta and olives',
      prepTime: '15 min',
      calories: '220 kcal',
    },
    {
      id: '2',
      name: 'Hummus',
      category: 'Mediterranean',
      shortDescription: 'Chickpea dip with tahini and lemon',
      prepTime: '10 min',
      calories: '180 kcal',
    },
    {
      id: '3',
      name: 'Falafel',
      category: 'Mediterranean',
      shortDescription: 'Crispy fried chickpea balls',
      prepTime: '30 min',
      calories: '320 kcal',
    },
    {
      id: '4',
      name: 'Grilled Fish',
      category: 'Mediterranean',
      shortDescription: 'Fresh fish with lemon and herbs',
      prepTime: '25 min',
      calories: '280 kcal',
    },
    {
      id: '5',
      name: 'Moussaka',
      category: 'Mediterranean',
      shortDescription: 'Layered eggplant casserole',
      prepTime: '90 min',
      calories: '480 kcal',
    },
    {
      id: '6',
      name: 'Baklava',
      category: 'Mediterranean',
      shortDescription: 'Sweet pastry with nuts and honey',
      prepTime: '60 min',
      calories: '420 kcal',
    },
  ];

  // First, try exact category match only
  const categoryRecipes = allRecipes.filter(
    (recipe) => recipe.category.toLowerCase() === searchLower
  );
  if (categoryRecipes.length > 0) {
    // Translate results if not in English
    if (currentLang !== 'en') {
      try {
        return await translateRecipeContent(categoryRecipes, currentLang);
      } catch (error) {
        console.error('Failed to translate category recipes:', error);
      }
    }
    return categoryRecipes;
  }

  // For all other searches, prioritize AI generation for better relevance
  // Only check static recipes if search directly matches recipe name
  const exactMatches = allRecipes.filter((recipe) => {
    const recipeName = recipe.name.toLowerCase();
    // Only match if search term appears as a significant part of the name
    return recipeName.includes(searchLower) && searchLower.length >= 4;
  });

  // If we have 1-3 exact name matches, return those
  if (exactMatches.length > 0 && exactMatches.length <= 3) {
    // Translate results if not in English
    if (currentLang !== 'en') {
      try {
        return await translateRecipeContent(exactMatches, currentLang);
      } catch (error) {
        console.error('Failed to translate exact matches:', error);
      }
    }
    return exactMatches;
  }

  // Otherwise, use AI to generate relevant recipes based on the search query
  if (ai) {
    try {
      const schema: Schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            shortDescription: { type: Type.STRING },
            prepTime: { type: Type.STRING },
            calories: { type: Type.STRING },
          },
          required: ['id', 'name', 'category', 'shortDescription', 'prepTime', 'calories'],
        },
      };

      const prompt = `Generate 6 diverse and delicious recipes based on this search query: "${englishQuery}". Make them appetizing, realistic, and varied. Include different cooking styles and difficulty levels. Provide accurate prep times (in format like "25 min") and calorie estimates (in format like "350 kcal").`;

      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const generatedRecipes = JSON.parse(result.text || '[]') as RecipeSummary[];
      if (generatedRecipes.length > 0) {
        // Translate AI-generated recipes if not in English
        if (currentLang !== 'en') {
          try {
            return await translateRecipeContent(generatedRecipes, currentLang);
          } catch (error) {
            console.error('Failed to translate AI-generated recipes:', error);
          }
        }
        return generatedRecipes;
      }
    } catch (error) {
      console.error('Error generating recipes with AI:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
    }
  }

  // If AI fails or is not available, return popular recipes as fallback
  const fallbackRecipes = [
    {
      id: '1',
      name: 'Classic Caesar Salad',
      category: 'General',
      shortDescription: 'Fresh romaine with parmesan and croutons',
      prepTime: '15 min',
      calories: '280 kcal',
    },
    {
      id: '2',
      name: 'Grilled Chicken Breast',
      category: 'General',
      shortDescription: 'Juicy herb-seasoned chicken',
      prepTime: '25 min',
      calories: '320 kcal',
    },
    {
      id: '3',
      name: 'Vegetable Stir Fry',
      category: 'General',
      shortDescription: 'Colorful mixed vegetables in savory sauce',
      prepTime: '20 min',
      calories: '240 kcal',
    },
    {
      id: '4',
      name: 'Beef Burger',
      category: 'General',
      shortDescription: 'Juicy beef patty with toppings',
      prepTime: '30 min',
      calories: '520 kcal',
    },
    {
      id: '5',
      name: 'Pasta Primavera',
      category: 'General',
      shortDescription: 'Pasta with fresh seasonal vegetables',
      prepTime: '25 min',
      calories: '380 kcal',
    },
    {
      id: '6',
      name: 'Fruit Salad',
      category: 'General',
      shortDescription: 'Fresh mixed fruits with honey',
      prepTime: '10 min',
      calories: '150 kcal',
    },
  ];

  // Translate fallback recipes if needed
  if (currentLang !== 'en') {
    try {
      return await translateRecipeContent(fallbackRecipes, currentLang);
    } catch (error) {
      console.error('Failed to translate fallback recipes:', error);
    }
  }

  return fallbackRecipes;
};

export const fetchRecipeDetails = async (
  recipeName: string,
  targetLanguage?: string
): Promise<RecipeDetail | null> => {
  // Get target language (fallback to current i18n language)
  const currentLang = targetLanguage || i18n.language;

  // Check cache first
  const cachedRecipe = getCachedRecipe(recipeName, currentLang);
  if (cachedRecipe) {
    if (import.meta.env.DEV) {
      console.log(`[Cache Hit] Recipe "${recipeName}" in ${currentLang}`);
    }
    return cachedRecipe;
  }

  if (import.meta.env.DEV) {
    console.log(`[Cache Miss] Fetching recipe "${recipeName}"`);
  }

  // Return detailed recipe information based on recipe name
  const recipes: { [key: string]: RecipeDetail } = {
    'Spaghetti Carbonara': {
      id: '1',
      name: 'Spaghetti Carbonara',
      category: 'Italian',
      shortDescription: 'Creamy pasta with bacon and eggs',
      prepTime: '20 min',
      calories: '450 kcal',
      ingredients: [
        '400g spaghetti',
        '200g pancetta or bacon',
        '4 large eggs',
        '100g Parmesan cheese, grated',
        '2 cloves garlic',
        'Salt and black pepper',
        'Fresh parsley',
      ],
      instructions: [
        'Cook spaghetti in salted boiling water until al dente',
        'Fry pancetta until crispy, add minced garlic',
        'Beat eggs with grated Parmesan in a bowl',
        'Drain pasta, reserving 1 cup pasta water',
        'Mix hot pasta with pancetta off heat',
        'Add egg mixture, tossing quickly (eggs should not scramble)',
        'Add pasta water to reach creamy consistency',
        'Season with pepper and garnish with parsley',
      ],
      tips: [
        'Use room temperature eggs to prevent scrambling',
        'The heat from the pasta cooks the eggs',
        'Reserve pasta water - the starch helps create a silky sauce',
      ],
    },
    'Margherita Pizza': {
      id: '2',
      name: 'Margherita Pizza',
      category: 'Italian',
      shortDescription: 'Classic pizza with tomato, mozzarella, and basil',
      prepTime: '30 min',
      calories: '380 kcal',
      ingredients: [
        'Pizza dough (store-bought or homemade)',
        '200g crushed tomatoes',
        '200g fresh mozzarella',
        'Fresh basil leaves',
        '2 tbsp olive oil',
        '2 cloves garlic',
        'Salt',
        'Oregano',
      ],
      instructions: [
        'Preheat oven to 475°F (245°C)',
        'Roll out pizza dough on floured surface',
        'Mix tomatoes with minced garlic, salt, and oregano',
        'Spread tomato sauce on dough, leaving 1-inch border',
        'Tear mozzarella and distribute evenly',
        'Drizzle with olive oil',
        'Bake for 12-15 minutes until crust is golden',
        'Top with fresh basil leaves before serving',
      ],
      tips: [
        'Use a pizza stone for crispier crust',
        "Don't overload with toppings",
        'Fresh mozzarella makes all the difference',
      ],
    },
    'Lasagna Bolognese': {
      id: '3',
      name: 'Lasagna Bolognese',
      category: 'Italian',
      shortDescription: 'Layered pasta with meat sauce and cheese',
      prepTime: '60 min',
      calories: '520 kcal',
      ingredients: [
        '12 lasagna sheets',
        '500g ground beef',
        '400g crushed tomatoes',
        '1 onion, diced',
        '2 carrots, diced',
        '2 celery stalks, diced',
        '500ml béchamel sauce',
        '200g Parmesan cheese',
        '2 tbsp tomato paste',
        'Red wine',
        'Olive oil',
      ],
      instructions: [
        'Brown ground beef in olive oil, set aside',
        'Sauté onion, carrots, and celery until soft',
        'Add beef back, stir in tomato paste',
        'Add crushed tomatoes and wine, simmer 30 minutes',
        'Cook lasagna sheets according to package',
        'Layer: sauce, pasta, béchamel, Parmesan - repeat',
        'Top layer should be béchamel and Parmesan',
        'Bake at 375°F (190°C) for 30-35 minutes until golden',
      ],
      tips: [
        'Let it rest 10 minutes before cutting',
        'Make the bolognese sauce ahead for better flavor',
        'Cover with foil if top browns too quickly',
      ],
    },
    'Sushi Rolls': {
      id: '1',
      name: 'Sushi Rolls',
      category: 'Japanese',
      shortDescription: 'Fresh fish and rice wrapped in seaweed',
      prepTime: '40 min',
      calories: '320 kcal',
      ingredients: [
        '2 cups sushi rice',
        '3 tbsp rice vinegar',
        '4 nori sheets',
        '200g fresh salmon or tuna',
        '1 cucumber, julienned',
        '1 avocado, sliced',
        'Soy sauce',
        'Wasabi',
        'Pickled ginger',
        'Sesame seeds',
      ],
      instructions: [
        'Cook sushi rice and mix with rice vinegar while warm',
        'Place nori sheet on bamboo mat, shiny side down',
        'Spread rice evenly, leaving 1-inch at top',
        'Arrange fish, cucumber, and avocado in a line',
        'Roll tightly using the bamboo mat',
        'Seal edge with a little water',
        'Cut into 6-8 pieces with sharp wet knife',
        'Serve with soy sauce, wasabi, and ginger',
      ],
      tips: [
        'Use very fresh, sushi-grade fish only',
        'Keep hands slightly wet to prevent sticking',
        'A sharp knife is essential for clean cuts',
      ],
    },
    'Ramen Noodles': {
      id: '2',
      name: 'Ramen Noodles',
      category: 'Japanese',
      shortDescription: 'Rich broth with noodles and toppings',
      prepTime: '45 min',
      calories: '480 kcal',
      ingredients: [
        '400g fresh ramen noodles',
        '1.5L chicken or pork broth',
        '2 tbsp miso paste',
        '2 tbsp soy sauce',
        '2 eggs',
        '200g pork belly, sliced',
        'Green onions',
        'Nori seaweed',
        'Bamboo shoots',
        'Sesame oil',
      ],
      instructions: [
        'Simmer broth with miso paste and soy sauce',
        'Soft boil eggs for 6-7 minutes, then ice bath',
        'Sear pork belly slices until crispy',
        'Cook ramen noodles according to package',
        'Divide noodles into bowls',
        'Ladle hot broth over noodles',
        'Top with pork, halved egg, green onions, and nori',
        'Drizzle with sesame oil',
      ],
      tips: [
        'Marinate eggs in soy sauce overnight for extra flavor',
        "Don't overcook the noodles",
        'Make broth in advance - flavor improves overnight',
      ],
    },
    'Teriyaki Chicken': {
      id: '3',
      name: 'Teriyaki Chicken',
      category: 'Japanese',
      shortDescription: 'Glazed chicken with sweet soy sauce',
      prepTime: '25 min',
      calories: '380 kcal',
      ingredients: [
        '4 chicken thighs',
        '1/4 cup soy sauce',
        '3 tbsp mirin',
        '2 tbsp sake or white wine',
        '2 tbsp brown sugar',
        '1 tbsp honey',
        '2 cloves garlic, minced',
        '1 tsp ginger, grated',
        'Sesame seeds',
        'Green onions',
      ],
      instructions: [
        'Mix soy sauce, mirin, sake, sugar, honey, garlic, and ginger',
        'Marinate chicken for 15 minutes',
        'Heat pan over medium-high heat',
        'Cook chicken skin-side down for 5-6 minutes',
        'Flip and cook another 5 minutes',
        'Pour sauce into pan',
        'Simmer, basting chicken until sauce thickens',
        'Garnish with sesame seeds and green onions',
      ],
      tips: [
        "Don't move chicken too much - let it develop a crust",
        'The sauce will thicken as it reduces',
        'Serve over rice to soak up extra sauce',
      ],
    },
    'Beef Tacos': {
      id: '1',
      name: 'Beef Tacos',
      category: 'Mexican',
      shortDescription: 'Seasoned beef in soft or crispy shells',
      prepTime: '25 min',
      calories: '380 kcal',
      ingredients: [
        '500g ground beef',
        '8 taco shells',
        '1 onion, diced',
        '2 cloves garlic',
        '2 tsp chili powder',
        '1 tsp cumin',
        '1 tsp paprika',
        'Lettuce, shredded',
        'Tomatoes, diced',
        'Cheddar cheese',
        'Sour cream',
        'Salsa',
      ],
      instructions: [
        'Brown ground beef over medium-high heat',
        'Add onion and garlic, cook until soft',
        'Stir in chili powder, cumin, paprika, salt',
        'Add 1/4 cup water, simmer 5 minutes',
        'Warm taco shells in oven',
        'Fill shells with seasoned beef',
        'Top with lettuce, tomatoes, cheese',
        'Serve with sour cream and salsa',
      ],
      tips: [
        'Drain excess fat from beef for healthier tacos',
        'Warm shells make them easier to fold',
        'Set up a taco bar for easy customization',
      ],
    },
    'Chicken Quesadilla': {
      id: '2',
      name: 'Chicken Quesadilla',
      category: 'Mexican',
      shortDescription: 'Grilled tortilla with cheese and chicken',
      prepTime: '20 min',
      calories: '420 kcal',
      ingredients: [
        '4 flour tortillas',
        '300g cooked chicken, shredded',
        '200g cheddar or Mexican cheese',
        '1 bell pepper, diced',
        '1 onion, diced',
        '2 tbsp olive oil',
        '1 tsp cumin',
        'Sour cream',
        'Guacamole',
        'Salsa',
      ],
      instructions: [
        'Sauté peppers and onions until soft',
        'Mix with chicken and cumin',
        'Heat tortilla in a pan',
        'Sprinkle cheese on half the tortilla',
        'Add chicken mixture',
        'Fold tortilla in half',
        'Cook 2-3 minutes per side until golden and cheese melts',
        'Cut into wedges and serve with toppings',
      ],
      tips: [
        'Press down with spatula for even browning',
        "Don't overfill or it will be hard to flip",
        'Use a mix of cheeses for better flavor',
      ],
    },
    Guacamole: {
      id: '3',
      name: 'Guacamole',
      category: 'Mexican',
      shortDescription: 'Fresh avocado dip with lime and cilantro',
      prepTime: '10 min',
      calories: '180 kcal',
      ingredients: [
        '3 ripe avocados',
        '1 lime, juiced',
        '1/2 onion, finely diced',
        '1 tomato, diced',
        '2 tbsp fresh cilantro, chopped',
        '1 jalapeño, minced',
        'Salt',
        'Cumin (optional)',
      ],
      instructions: [
        'Cut avocados in half, remove pit',
        'Scoop flesh into bowl',
        'Mash with fork to desired consistency',
        'Add lime juice immediately',
        'Stir in onion, tomato, cilantro, jalapeño',
        'Season with salt and cumin',
        'Mix gently',
        'Serve immediately with tortilla chips',
      ],
      tips: [
        'Choose ripe but not mushy avocados',
        'Lime juice prevents browning',
        'Leave one avocado pit in the guacamole to keep it green',
      ],
    },
    Churros: {
      id: '5',
      name: 'Churros',
      category: 'Mexican',
      shortDescription: 'Fried dough with cinnamon sugar',
      prepTime: '30 min',
      calories: '340 kcal',
      ingredients: [
        '1 cup water',
        '2 tbsp sugar',
        '1/2 tsp salt',
        '2 tbsp vegetable oil',
        '1 cup flour',
        'Oil for frying',
        '1/2 cup sugar for coating',
        '1 tbsp cinnamon',
      ],
      instructions: [
        'Bring water, 2 tbsp sugar, salt, and oil to a boil',
        'Remove from heat, stir in flour until dough forms',
        'Let cool 5 minutes',
        'Transfer to piping bag with star tip',
        'Heat 2 inches of oil to 375°F (190°C)',
        'Pipe 4-inch strips directly into oil',
        'Fry until golden, about 2 minutes per side',
        'Mix cinnamon and sugar, coat hot churros',
      ],
      tips: [
        "Don't let the dough cool completely before piping",
        'Maintain oil temperature for crispy churros',
        'Serve with chocolate sauce for dipping',
      ],
    },
    'Butter Chicken': {
      id: '1',
      name: 'Butter Chicken',
      category: 'Indian',
      shortDescription: 'Creamy tomato-based chicken curry',
      prepTime: '45 min',
      calories: '480 kcal',
      ingredients: [
        '600g chicken breast, cubed',
        '200ml heavy cream',
        '400g crushed tomatoes',
        '3 tbsp butter',
        '1 onion, diced',
        '4 cloves garlic',
        '1 tbsp ginger',
        '2 tsp garam masala',
        '1 tsp turmeric',
        '1 tsp chili powder',
        'Fresh cilantro',
      ],
      instructions: [
        'Marinate chicken in yogurt and spices for 30 minutes',
        'Melt butter, sauté onion until golden',
        'Add garlic and ginger, cook 1 minute',
        'Add tomatoes and spices, simmer 10 minutes',
        'Add marinated chicken, cook until done',
        'Stir in cream',
        'Simmer 5 minutes until sauce thickens',
        'Garnish with cilantro, serve with naan',
      ],
      tips: [
        'Marinating longer makes chicken more tender',
        'Add kasuri methi (dried fenugreek) for authentic flavor',
        'Adjust spice level to your preference',
      ],
    },
    'Pad Thai': {
      id: '1',
      name: 'Pad Thai',
      category: 'Thai',
      shortDescription: 'Stir-fried rice noodles with tamarind sauce',
      prepTime: '25 min',
      calories: '420 kcal',
      ingredients: [
        '200g rice noodles',
        '200g shrimp or chicken',
        '2 eggs',
        '3 tbsp tamarind paste',
        '2 tbsp fish sauce',
        '2 tbsp sugar',
        '2 cloves garlic',
        'Bean sprouts',
        'Peanuts, crushed',
        'Green onions',
        'Lime wedges',
      ],
      instructions: [
        'Soak rice noodles in warm water for 20 minutes',
        'Mix tamarind paste, fish sauce, and sugar for sauce',
        'Heat wok, scramble eggs, set aside',
        'Stir-fry garlic and shrimp until cooked',
        'Add drained noodles and sauce',
        'Toss everything together',
        'Add bean sprouts and eggs',
        'Serve topped with peanuts, green onions, and lime',
      ],
      tips: [
        "Don't over-soak the noodles",
        'High heat is key for authentic flavor',
        'Adjust sweet-sour-salty balance to taste',
      ],
    },
    'Quinoa Buddha Bowl': {
      id: '1',
      name: 'Quinoa Buddha Bowl',
      category: 'Vegan',
      shortDescription: 'Healthy bowl with quinoa and vegetables',
      prepTime: '25 min',
      calories: '380 kcal',
      ingredients: [
        '1 cup quinoa',
        '1 sweet potato, cubed',
        '1 cup chickpeas',
        '2 cups kale',
        '1 avocado',
        '2 tbsp tahini',
        '1 lemon, juiced',
        '2 tbsp olive oil',
        'Garlic powder',
        'Cumin',
        'Salt',
      ],
      instructions: [
        'Cook quinoa according to package instructions',
        'Roast sweet potato cubes at 400°F for 20 minutes',
        'Roast chickpeas with cumin until crispy',
        'Massage kale with olive oil and lemon',
        'Make dressing: mix tahini, lemon juice, water',
        'Arrange quinoa, sweet potato, chickpeas, kale in bowl',
        'Top with sliced avocado',
        'Drizzle with tahini dressing',
      ],
      tips: [
        'Meal prep these bowls for the week',
        'Customize with your favorite vegetables',
        'Tahini dressing keeps well in the fridge',
      ],
    },
    'Chocolate Cake': {
      id: '1',
      name: 'Chocolate Cake',
      category: 'Dessert',
      shortDescription: 'Rich and moist chocolate layer cake',
      prepTime: '60 min',
      calories: '520 kcal',
      ingredients: [
        '2 cups flour',
        '2 cups sugar',
        '3/4 cup cocoa powder',
        '2 tsp baking soda',
        '1 tsp salt',
        '2 eggs',
        '1 cup buttermilk',
        '1 cup coffee, strong',
        '1/2 cup vegetable oil',
        '2 tsp vanilla',
        'Chocolate frosting',
      ],
      instructions: [
        'Preheat oven to 350°F (175°C)',
        'Grease two 9-inch round pans',
        'Mix dry ingredients in large bowl',
        'Beat eggs, buttermilk, coffee, oil, vanilla',
        'Add wet ingredients to dry, mix until smooth',
        'Divide batter between pans',
        'Bake 30-35 minutes until toothpick comes out clean',
        'Cool completely, then frost',
      ],
      tips: [
        'Coffee enhances chocolate flavor without tasting like coffee',
        "Don't overmix the batter",
        'Level cake layers for professional look',
      ],
    },
    'Greek Salad': {
      id: '1',
      name: 'Greek Salad',
      category: 'Mediterranean',
      shortDescription: 'Fresh vegetables with feta and olives',
      prepTime: '15 min',
      calories: '220 kcal',
      ingredients: [
        '4 tomatoes, cut into wedges',
        '1 cucumber, sliced',
        '1 red onion, sliced',
        '1 green pepper, sliced',
        '200g feta cheese',
        '1 cup Kalamata olives',
        '3 tbsp olive oil',
        '1 tbsp red wine vinegar',
        'Oregano',
        'Salt and pepper',
      ],
      instructions: [
        'Cut tomatoes, cucumber, onion, and pepper',
        'Arrange vegetables in a large bowl',
        'Top with crumbled feta and olives',
        'Whisk olive oil, vinegar, oregano, salt, pepper',
        'Drizzle dressing over salad',
        'Toss gently',
        'Let sit 5 minutes for flavors to meld',
        'Serve immediately',
      ],
      tips: [
        'Use ripe, flavorful tomatoes for best results',
        "Don't refrigerate - serve at room temperature",
        'Traditional Greek salad has no lettuce',
      ],
    },
    'Risotto Milanese': {
      id: '4',
      name: 'Risotto Milanese',
      category: 'Italian',
      shortDescription: 'Creamy saffron rice dish',
      prepTime: '35 min',
      calories: '400 kcal',
      ingredients: [
        '400g Arborio rice',
        '1L chicken stock',
        '1/4 tsp saffron threads',
        '1 onion, finely diced',
        '100ml white wine',
        '50g butter',
        '100g Parmesan, grated',
        '2 tbsp olive oil',
        'Salt and pepper',
      ],
      instructions: [
        'Warm stock and steep saffron in it',
        'Heat olive oil and half the butter',
        'Sauté onion until translucent',
        'Add rice, toast for 2 minutes',
        'Add wine, stir until absorbed',
        'Add stock one ladle at a time, stirring constantly',
        'Continue until rice is creamy and al dente (20 min)',
        'Stir in remaining butter and Parmesan',
        'Season and serve immediately',
      ],
      tips: [
        'Stir constantly for creamiest texture',
        'Rice should be al dente, not mushy',
        'Add warm stock gradually - never cold',
      ],
    },
    Tiramisu: {
      id: '5',
      name: 'Tiramisu',
      category: 'Italian',
      shortDescription: 'Coffee-flavored Italian dessert',
      prepTime: '25 min',
      calories: '340 kcal',
      ingredients: [
        '6 egg yolks',
        '3/4 cup sugar',
        '500g mascarpone cheese',
        '1 1/2 cups strong espresso, cooled',
        '3 tbsp coffee liqueur',
        '24 ladyfinger biscuits',
        'Cocoa powder for dusting',
        'Dark chocolate shavings',
      ],
      instructions: [
        'Beat egg yolks and sugar until thick and pale',
        'Add mascarpone, beat until smooth',
        'Mix espresso with coffee liqueur in shallow dish',
        'Quickly dip ladyfingers in coffee mixture',
        'Layer dipped ladyfingers in dish',
        'Spread half the mascarpone mixture over ladyfingers',
        'Repeat with another layer',
        'Dust generously with cocoa powder',
        'Refrigerate 4 hours or overnight',
      ],
      tips: [
        'Use high-quality mascarpone for best flavor',
        "Don't oversoak ladyfingers - just a quick dip",
        'Tastes even better the next day',
      ],
    },
    'Pesto Pasta': {
      id: '6',
      name: 'Pesto Pasta',
      category: 'Italian',
      shortDescription: 'Pasta with fresh basil pesto sauce',
      prepTime: '15 min',
      calories: '420 kcal',
      ingredients: [
        '400g pasta (linguine or spaghetti)',
        '2 cups fresh basil leaves',
        '1/2 cup pine nuts',
        '3 cloves garlic',
        '1/2 cup Parmesan cheese',
        '1/2 cup olive oil',
        'Salt and pepper',
        'Cherry tomatoes (optional)',
      ],
      instructions: [
        'Toast pine nuts in dry pan until golden',
        'Blend basil, pine nuts, garlic, Parmesan in food processor',
        'Slowly add olive oil while blending',
        'Season with salt and pepper',
        'Cook pasta in salted water until al dente',
        'Reserve 1/2 cup pasta water',
        'Drain pasta, return to pot',
        'Toss with pesto, adding pasta water to thin',
        'Garnish with extra Parmesan and pine nuts',
      ],
      tips: [
        'Use fresh basil for best flavor',
        'Add pasta water gradually for perfect consistency',
        'Pesto freezes well in ice cube trays',
      ],
    },
    Tempura: {
      id: '4',
      name: 'Tempura',
      category: 'Japanese',
      shortDescription: 'Lightly battered and fried seafood and vegetables',
      prepTime: '30 min',
      calories: '340 kcal',
      ingredients: [
        '200g shrimp, peeled',
        'Assorted vegetables (sweet potato, zucchini, bell pepper)',
        '1 cup flour',
        '1 egg yolk',
        '1 cup ice cold water',
        'Oil for deep frying',
        'Tempura dipping sauce',
        'Grated daikon radish',
      ],
      instructions: [
        'Heat oil to 350°F (175°C)',
        'Mix egg yolk with ice water',
        'Add flour, stir gently (lumps are okay)',
        'Pat shrimp and vegetables dry',
        'Dip in batter, let excess drip off',
        'Fry in batches until light golden (2-3 min)',
        'Drain on paper towels',
        'Serve immediately with dipping sauce and daikon',
      ],
      tips: [
        'Keep batter ice cold for crispy tempura',
        "Don't overmix - lumps are fine",
        'Fry in small batches to maintain oil temperature',
      ],
    },
    'Miso Soup': {
      id: '5',
      name: 'Miso Soup',
      category: 'Japanese',
      shortDescription: 'Traditional Japanese soup with tofu',
      prepTime: '15 min',
      calories: '120 kcal',
      ingredients: [
        '4 cups dashi stock',
        '3 tbsp miso paste',
        '200g silken tofu, cubed',
        '2 green onions, sliced',
        '1 sheet nori, cut into strips',
        'Wakame seaweed (dried)',
      ],
      instructions: [
        'Bring dashi stock to gentle simmer',
        'Add wakame, let rehydrate for 2 minutes',
        'Add tofu cubes, heat through',
        'Remove from heat',
        'Dissolve miso paste in small amount of hot broth',
        'Stir miso mixture into soup',
        'Add green onions and nori',
        "Serve immediately (don't boil after adding miso)",
      ],
      tips: [
        'Never boil miso soup after adding miso paste',
        'Use good quality miso for best flavor',
        'Great as a light breakfast or starter',
      ],
    },
    Yakitori: {
      id: '6',
      name: 'Yakitori',
      category: 'Japanese',
      shortDescription: 'Grilled chicken skewers',
      prepTime: '20 min',
      calories: '280 kcal',
      ingredients: [
        '500g chicken thighs, cut into chunks',
        '4 green onions, cut into pieces',
        '1/2 cup soy sauce',
        '1/4 cup mirin',
        '2 tbsp sake',
        '2 tbsp sugar',
        'Bamboo skewers, soaked',
        'Sesame seeds',
      ],
      instructions: [
        'Make sauce: simmer soy sauce, mirin, sake, sugar until thickened',
        'Thread chicken and green onions onto skewers',
        'Preheat grill or broiler to high',
        'Grill skewers 3-4 minutes per side',
        'Brush with sauce while grilling',
        'Continue grilling and basting until cooked through',
        'Sprinkle with sesame seeds',
        'Serve hot with extra sauce',
      ],
      tips: [
        'Soak bamboo skewers to prevent burning',
        'Dark meat stays juicier than breast',
        'Great for outdoor grilling',
      ],
    },
    Enchiladas: {
      id: '4',
      name: 'Enchiladas',
      category: 'Mexican',
      shortDescription: 'Rolled tortillas with sauce and filling',
      prepTime: '45 min',
      calories: '480 kcal',
      ingredients: [
        '8 corn tortillas',
        '400g cooked chicken, shredded',
        '2 cups enchilada sauce',
        '200g cheddar cheese',
        '1 onion, diced',
        '1 bell pepper, diced',
        'Sour cream',
        'Fresh cilantro',
        'Lime wedges',
      ],
      instructions: [
        'Preheat oven to 375°F (190°C)',
        'Mix chicken with half the cheese, onion, pepper',
        'Warm tortillas to make them pliable',
        'Spread 1/2 cup sauce in baking dish',
        'Fill each tortilla with chicken mixture',
        'Roll and place seam-side down in dish',
        'Pour remaining sauce over enchiladas',
        'Top with remaining cheese',
        'Bake 25-30 minutes until bubbly',
        'Garnish with cilantro, serve with sour cream',
      ],
      tips: [
        'Warm tortillas prevent cracking',
        'Use homemade enchilada sauce for best flavor',
        'Cover with foil if cheese browns too quickly',
      ],
    },
    Nachos: {
      id: '6',
      name: 'Nachos',
      category: 'Mexican',
      shortDescription: 'Crispy tortilla chips with toppings',
      prepTime: '15 min',
      calories: '520 kcal',
      ingredients: [
        'Tortilla chips',
        '300g ground beef or chicken',
        '200g cheddar cheese, shredded',
        '1 cup refried beans',
        'Jalapeños, sliced',
        'Tomatoes, diced',
        'Sour cream',
        'Guacamole',
        'Salsa',
        'Black olives',
        'Green onions',
      ],
      instructions: [
        'Preheat oven to 400°F (200°C)',
        'Brown meat with taco seasoning',
        'Spread chips on large baking sheet',
        'Sprinkle half the cheese over chips',
        'Add dollops of beans and cooked meat',
        'Top with remaining cheese',
        'Bake 5-7 minutes until cheese melts',
        'Top with jalapeños, tomatoes, olives',
        'Serve with sour cream, guacamole, salsa',
      ],
      tips: [
        'Layer ingredients for even coverage',
        "Don't overload or chips will get soggy",
        'Serve immediately while hot and crispy',
      ],
    },
    'Chicken Tikka Masala': {
      id: '2',
      name: 'Chicken Tikka Masala',
      category: 'Indian',
      shortDescription: 'Spiced chicken in tomato cream sauce',
      prepTime: '40 min',
      calories: '450 kcal',
      ingredients: [
        '600g chicken breast, cubed',
        '1 cup yogurt',
        '2 tbsp tikka masala spice',
        '400g crushed tomatoes',
        '200ml heavy cream',
        '1 onion, diced',
        '4 cloves garlic',
        '2 tbsp ginger',
        '3 tbsp butter',
        'Fresh cilantro',
        'Garam masala',
      ],
      instructions: [
        'Marinate chicken in yogurt and half the tikka spices for 2 hours',
        'Grill or bake marinated chicken until charred',
        'Melt butter, sauté onion until golden',
        'Add garlic, ginger, remaining tikka spice',
        'Add tomatoes, simmer 15 minutes',
        'Blend sauce until smooth',
        'Add chicken pieces',
        'Stir in cream and garam masala',
        'Simmer 10 minutes',
        'Garnish with cilantro',
      ],
      tips: [
        'Marinate overnight for deeper flavor',
        'Char the chicken for authentic taste',
        'Adjust cream for desired richness',
      ],
    },
    'Palak Paneer': {
      id: '3',
      name: 'Palak Paneer',
      category: 'Indian',
      shortDescription: 'Spinach curry with cottage cheese',
      prepTime: '30 min',
      calories: '320 kcal',
      ingredients: [
        '500g fresh spinach',
        '250g paneer, cubed',
        '1 onion, diced',
        '2 tomatoes, chopped',
        '4 cloves garlic',
        '1 tbsp ginger',
        '2 green chilies',
        '1 tsp cumin seeds',
        '1 tsp garam masala',
        '100ml cream',
        'Ghee or oil',
      ],
      instructions: [
        'Blanch spinach in boiling water, then ice bath',
        'Blend spinach with green chilies to smooth paste',
        'Heat ghee, fry paneer cubes until golden, set aside',
        'Add cumin seeds, let splutter',
        'Sauté onion, garlic, ginger until soft',
        'Add tomatoes, cook until soft',
        'Add spinach puree and spices',
        'Simmer 10 minutes',
        'Add paneer and cream',
        'Cook 5 more minutes',
      ],
      tips: [
        "Don't overcook spinach to keep bright green color",
        'Fry paneer for better texture',
        'Serve with naan or rice',
      ],
    },
    Biryani: {
      id: '4',
      name: 'Biryani',
      category: 'Indian',
      shortDescription: 'Fragrant rice with meat or vegetables',
      prepTime: '60 min',
      calories: '550 kcal',
      ingredients: [
        '2 cups basmati rice',
        '500g chicken or lamb',
        '1 cup yogurt',
        '2 onions, sliced',
        '4 cloves garlic',
        '2 tbsp ginger',
        'Whole spices (bay, cinnamon, cardamom)',
        'Saffron in warm milk',
        'Fresh mint and cilantro',
        'Ghee',
        'Biryani masala',
      ],
      instructions: [
        'Marinate meat in yogurt and spices for 2 hours',
        'Parboil rice with whole spices until 70% cooked',
        'Deep fry onions until golden and crispy',
        'Cook marinated meat until tender',
        'Layer rice and meat in heavy pot',
        'Top with fried onions, saffron milk, mint',
        'Cover tightly, cook on low heat 20 minutes',
        'Let rest 5 minutes before opening',
        'Mix gently and serve',
      ],
      tips: [
        'Use aged basmati for best results',
        'The layering is key to authentic biryani',
        'Tight seal keeps steam and flavor in',
      ],
    },
    'Dal Makhani': {
      id: '5',
      name: 'Dal Makhani',
      category: 'Indian',
      shortDescription: 'Creamy black lentil curry',
      prepTime: '50 min',
      calories: '380 kcal',
      ingredients: [
        '1 cup whole black lentils (urad dal)',
        '1/4 cup kidney beans',
        '3 tomatoes, pureed',
        '1 onion, diced',
        '4 cloves garlic',
        '1 tbsp ginger',
        '100ml cream',
        '3 tbsp butter',
        '1 tsp cumin',
        '1 tsp garam masala',
        'Kasuri methi (dried fenugreek)',
      ],
      instructions: [
        'Soak lentils and beans overnight',
        'Pressure cook with water until very soft',
        'Heat butter, sauté onion until golden',
        'Add garlic, ginger, cook 1 minute',
        'Add tomato puree and spices',
        'Cook until oil separates',
        'Add cooked lentils with liquid',
        'Simmer on low heat for 30 minutes, stirring often',
        'Add cream and kasuri methi',
        'Cook 5 more minutes',
      ],
      tips: [
        'Slow cooking makes it creamier',
        'Traditionally cooked overnight',
        'Tastes better the next day',
      ],
    },
    Samosas: {
      id: '6',
      name: 'Samosas',
      category: 'Indian',
      shortDescription: 'Crispy fried pastries with spiced filling',
      prepTime: '40 min',
      calories: '280 kcal',
      ingredients: [
        '2 cups flour',
        '4 tbsp oil',
        '3 potatoes, boiled and mashed',
        '1 cup peas',
        '1 onion, finely diced',
        '2 tsp cumin seeds',
        '1 tsp coriander powder',
        '1 tsp garam masala',
        'Green chilies',
        'Fresh cilantro',
        'Oil for frying',
      ],
      instructions: [
        'Make dough: mix flour, 4 tbsp oil, water, knead until smooth',
        'Heat oil, add cumin seeds',
        'Sauté onion until soft',
        'Add peas, potatoes, spices, cook 5 minutes',
        'Roll dough into circles, cut in half',
        'Form cone shape, fill with potato mixture',
        'Seal edges with water',
        'Deep fry until golden brown',
        'Serve hot with chutney',
      ],
      tips: [
        'Dough should be firm, not soft',
        'Seal edges well to prevent opening',
        'Fry on medium heat for even cooking',
      ],
    },
    'Green Curry': {
      id: '2',
      name: 'Green Curry',
      category: 'Thai',
      shortDescription: 'Spicy coconut curry with vegetables',
      prepTime: '35 min',
      calories: '380 kcal',
      ingredients: [
        '400ml coconut milk',
        '3 tbsp green curry paste',
        '300g chicken, sliced',
        '1 eggplant, cubed',
        '1 bell pepper, sliced',
        'Bamboo shoots',
        'Thai basil leaves',
        '2 tbsp fish sauce',
        '1 tbsp palm sugar',
        'Kaffir lime leaves',
      ],
      instructions: [
        'Heat thick part of coconut milk until oil separates',
        'Add green curry paste, fry until fragrant',
        'Add chicken, cook until no longer pink',
        'Add remaining coconut milk and vegetables',
        'Add fish sauce, sugar, lime leaves',
        'Simmer until vegetables are tender',
        'Stir in Thai basil',
        'Serve over jasmine rice',
      ],
      tips: [
        'Adjust spice level with curry paste amount',
        "Don't overcook vegetables",
        'Fresh curry paste makes a huge difference',
      ],
    },
    'Tom Yum Soup': {
      id: '3',
      name: 'Tom Yum Soup',
      category: 'Thai',
      shortDescription: 'Hot and sour Thai soup',
      prepTime: '20 min',
      calories: '180 kcal',
      ingredients: [
        '4 cups chicken stock',
        '200g shrimp, peeled',
        '3 stalks lemongrass, bruised',
        '4 kaffir lime leaves',
        '3 Thai chilies',
        '200g mushrooms',
        '2 tomatoes, quartered',
        '3 tbsp lime juice',
        '2 tbsp fish sauce',
        'Fresh cilantro',
      ],
      instructions: [
        'Bring stock to boil with lemongrass and lime leaves',
        'Add mushrooms and tomatoes',
        'Simmer 5 minutes',
        'Add shrimp, cook until pink',
        'Add fish sauce and chilies',
        'Remove from heat',
        'Add lime juice',
        'Garnish with cilantro',
        'Serve hot',
      ],
      tips: [
        "Don't eat the lemongrass and lime leaves",
        'Adjust sourness with lime juice',
        'Add coconut milk for Tom Yum Goong',
      ],
    },
    'Massaman Curry': {
      id: '4',
      name: 'Massaman Curry',
      category: 'Thai',
      shortDescription: 'Rich peanut-based curry',
      prepTime: '45 min',
      calories: '480 kcal',
      ingredients: [
        '400ml coconut milk',
        '3 tbsp Massaman curry paste',
        '500g beef or chicken',
        '3 potatoes, cubed',
        '1 onion, quartered',
        '1/2 cup roasted peanuts',
        '2 tbsp tamarind paste',
        '2 tbsp palm sugar',
        '3 tbsp fish sauce',
        'Bay leaves',
        'Cinnamon stick',
      ],
      instructions: [
        'Fry curry paste in thick coconut cream',
        'Add meat, coat with paste',
        'Add remaining coconut milk and spices',
        'Simmer until meat is tender (30 min)',
        'Add potatoes and onions',
        'Cook until potatoes are soft',
        'Stir in tamarind, sugar, fish sauce',
        'Add peanuts',
        'Simmer 5 more minutes',
      ],
      tips: [
        'Slow cooking makes meat more tender',
        'Balance sweet, sour, and salty flavors',
        'Traditionally made with beef',
      ],
    },
    'Som Tam': {
      id: '5',
      name: 'Som Tam',
      category: 'Thai',
      shortDescription: 'Spicy green papaya salad',
      prepTime: '15 min',
      calories: '150 kcal',
      ingredients: [
        '2 cups green papaya, shredded',
        '2 cloves garlic',
        '2-3 Thai chilies',
        '2 tbsp dried shrimp',
        '1/4 cup roasted peanuts',
        '2 tomatoes, cut into wedges',
        '2 tbsp lime juice',
        '1 tbsp fish sauce',
        '1 tbsp palm sugar',
        'Long beans',
      ],
      instructions: [
        'Pound garlic and chilies in mortar',
        'Add palm sugar, pound to combine',
        'Add dried shrimp, pound lightly',
        'Add green papaya, pound to bruise',
        'Add fish sauce and lime juice',
        'Add tomatoes and beans, toss gently',
        'Add peanuts, toss',
        'Adjust seasoning',
        'Serve immediately',
      ],
      tips: [
        'Use a mortar and pestle for authentic texture',
        'Adjust chili level to preference',
        'Great with grilled chicken',
      ],
    },
    'Mango Sticky Rice': {
      id: '6',
      name: 'Mango Sticky Rice',
      category: 'Thai',
      shortDescription: 'Sweet coconut rice with fresh mango',
      prepTime: '30 min',
      calories: '320 kcal',
      ingredients: [
        '2 cups sticky rice',
        '1 cup coconut milk',
        '1/2 cup sugar',
        '1/2 tsp salt',
        '2 ripe mangoes, sliced',
        'Sesame seeds for garnish',
        'Mung beans (optional)',
      ],
      instructions: [
        'Soak sticky rice for 4 hours',
        'Steam rice until tender (20-25 min)',
        'Heat coconut milk with sugar and salt',
        'Pour warm coconut milk over hot rice',
        'Cover and let sit 15 minutes',
        'Serve rice with sliced mango',
        'Drizzle with extra coconut cream',
        'Sprinkle with sesame seeds',
      ],
      tips: [
        'Use Thai sticky rice, not regular rice',
        'Mangoes should be ripe and sweet',
        'Best served at room temperature',
      ],
    },
    'Lentil Soup': {
      id: '2',
      name: 'Lentil Soup',
      category: 'Vegan',
      shortDescription: 'Hearty and nutritious lentil soup',
      prepTime: '40 min',
      calories: '280 kcal',
      ingredients: [
        '2 cups red lentils',
        '1 onion, diced',
        '2 carrots, diced',
        '2 celery stalks, diced',
        '4 cloves garlic',
        '1 can diced tomatoes',
        '6 cups vegetable broth',
        '2 tsp cumin',
        '1 tsp turmeric',
        'Bay leaves',
        'Lemon juice',
        'Fresh parsley',
      ],
      instructions: [
        'Sauté onion, carrots, celery until soft',
        'Add garlic and spices, cook 1 minute',
        'Add lentils, tomatoes, broth',
        'Add bay leaves',
        'Bring to boil, then simmer 25-30 minutes',
        'Remove bay leaves',
        'Blend partially if desired',
        'Add lemon juice',
        'Season to taste',
        'Garnish with parsley',
      ],
      tips: [
        'Red lentils cook faster than other varieties',
        'Soup thickens as it sits - add water as needed',
        'Freezes well for meal prep',
      ],
    },
    'Vegan Tacos': {
      id: '3',
      name: 'Vegan Tacos',
      category: 'Vegan',
      shortDescription: 'Plant-based tacos with beans and veggies',
      prepTime: '20 min',
      calories: '320 kcal',
      ingredients: [
        '8 corn tortillas',
        '2 cups black beans, cooked',
        '1 bell pepper, diced',
        '1 onion, diced',
        '1 cup corn',
        '2 tsp cumin',
        '1 tsp chili powder',
        'Avocado, sliced',
        'Salsa',
        'Cilantro',
        'Lime wedges',
        'Cabbage slaw',
      ],
      instructions: [
        'Sauté onion and pepper until soft',
        'Add black beans, corn, and spices',
        'Cook until heated through',
        'Warm tortillas',
        'Fill with bean mixture',
        'Top with avocado, salsa, cilantro',
        'Add cabbage slaw for crunch',
        'Squeeze lime over top',
        'Serve immediately',
      ],
      tips: [
        "Season beans well - they're the star",
        'Toast tortillas for extra flavor',
        'Add hot sauce for spice',
      ],
    },
    'Chickpea Curry': {
      id: '4',
      name: 'Chickpea Curry',
      category: 'Vegan',
      shortDescription: 'Spiced chickpeas in tomato sauce',
      prepTime: '35 min',
      calories: '360 kcal',
      ingredients: [
        '2 cans chickpeas, drained',
        '1 can coconut milk',
        '400g crushed tomatoes',
        '1 onion, diced',
        '4 cloves garlic',
        '2 tbsp ginger',
        '2 tsp curry powder',
        '1 tsp cumin',
        '1 tsp turmeric',
        'Fresh spinach',
        'Cilantro',
      ],
      instructions: [
        'Sauté onion until golden',
        'Add garlic and ginger, cook 1 minute',
        'Add spices, toast 30 seconds',
        'Add tomatoes, simmer 10 minutes',
        'Add chickpeas and coconut milk',
        'Simmer 15 minutes until thickened',
        'Stir in spinach until wilted',
        'Season to taste',
        'Garnish with cilantro',
      ],
      tips: [
        'Great for meal prep',
        'Serve over rice or with naan',
        'Add more coconut milk for creamier curry',
      ],
    },
    'Avocado Toast': {
      id: '5',
      name: 'Avocado Toast',
      category: 'Vegan',
      shortDescription: 'Crusty bread with mashed avocado',
      prepTime: '10 min',
      calories: '240 kcal',
      ingredients: [
        '2 slices whole grain bread',
        '1 ripe avocado',
        'Lemon juice',
        'Red pepper flakes',
        'Salt and pepper',
        'Cherry tomatoes',
        'Microgreens or arugula',
        'Everything bagel seasoning',
      ],
      instructions: [
        'Toast bread until golden and crispy',
        'Mash avocado with lemon juice',
        'Season with salt and pepper',
        'Spread avocado on toast',
        'Top with sliced cherry tomatoes',
        'Sprinkle with red pepper flakes',
        'Add microgreens',
        'Finish with everything seasoning',
      ],
      tips: [
        'Use perfectly ripe avocado',
        'Add nutritional yeast for cheesy flavor',
        'Top with hemp seeds for protein',
      ],
    },
    'Veggie Stir Fry': {
      id: '6',
      name: 'Veggie Stir Fry',
      category: 'Vegan',
      shortDescription: 'Colorful vegetables in savory sauce',
      prepTime: '20 min',
      calories: '260 kcal',
      ingredients: [
        '2 cups broccoli florets',
        '1 bell pepper, sliced',
        '1 cup snap peas',
        '1 carrot, sliced',
        '200g mushrooms',
        '3 cloves garlic',
        '1 tbsp ginger',
        '3 tbsp soy sauce',
        '1 tbsp sesame oil',
        '2 tsp cornstarch',
        'Sesame seeds',
      ],
      instructions: [
        'Mix soy sauce, sesame oil, cornstarch with water',
        'Heat wok or large pan over high heat',
        'Add garlic and ginger, stir-fry 30 seconds',
        'Add harder vegetables (carrot, broccoli) first',
        'Stir-fry 3 minutes',
        'Add softer vegetables',
        'Stir-fry 2 more minutes',
        'Add sauce, toss until thickened',
        'Garnish with sesame seeds',
      ],
      tips: [
        'Keep vegetables crisp-tender',
        "Don't overcrowd the pan",
        'Serve over rice or noodles',
      ],
    },
    Cheesecake: {
      id: '2',
      name: 'Cheesecake',
      category: 'Dessert',
      shortDescription: 'Creamy New York style cheesecake',
      prepTime: '90 min',
      calories: '480 kcal',
      ingredients: [
        '2 cups graham cracker crumbs',
        '1/2 cup butter, melted',
        '900g cream cheese, softened',
        '1 cup sugar',
        '4 eggs',
        '1 tsp vanilla extract',
        '1/2 cup sour cream',
        'Pinch of salt',
      ],
      instructions: [
        'Preheat oven to 325°F (160°C)',
        'Mix graham crumbs with melted butter',
        'Press into bottom of 9-inch springform pan',
        'Beat cream cheese and sugar until smooth',
        'Add eggs one at a time',
        'Mix in vanilla and sour cream',
        'Pour over crust',
        'Bake 55-60 minutes (center should jiggle slightly)',
        'Cool completely, refrigerate 4 hours',
      ],
      tips: [
        'Room temperature ingredients mix smoother',
        "Don't overbake - it sets as it cools",
        'Water bath prevents cracks',
      ],
    },
    'Apple Pie': {
      id: '3',
      name: 'Apple Pie',
      category: 'Dessert',
      shortDescription: 'Classic American apple pie',
      prepTime: '75 min',
      calories: '420 kcal',
      ingredients: [
        '2 pie crusts',
        '6 cups apples, peeled and sliced',
        '3/4 cup sugar',
        '2 tbsp flour',
        '1 tsp cinnamon',
        '1/4 tsp nutmeg',
        '2 tbsp butter',
        '1 egg for wash',
        'Vanilla ice cream for serving',
      ],
      instructions: [
        'Preheat oven to 425°F (220°C)',
        'Mix apples with sugar, flour, cinnamon, nutmeg',
        'Line pie dish with one crust',
        'Fill with apple mixture',
        'Dot with butter',
        'Cover with second crust, seal edges',
        'Cut vents in top',
        'Brush with beaten egg',
        'Bake 45-50 minutes until golden',
        'Cool before slicing',
      ],
      tips: [
        'Use mix of tart and sweet apples',
        "Don't skip the egg wash for golden crust",
        'Serve warm with vanilla ice cream',
      ],
    },
    'Chocolate Brownies': {
      id: '5',
      name: 'Chocolate Brownies',
      category: 'Dessert',
      shortDescription: 'Fudgy chocolate brownies',
      prepTime: '35 min',
      calories: '340 kcal',
      ingredients: [
        '200g dark chocolate',
        '150g butter',
        '1 cup sugar',
        '3 eggs',
        '3/4 cup flour',
        '1/4 cup cocoa powder',
        '1/2 tsp salt',
        '1 tsp vanilla',
        'Chocolate chips (optional)',
      ],
      instructions: [
        'Preheat oven to 350°F (175°C)',
        'Grease 9x9 inch pan',
        'Melt chocolate and butter together',
        'Stir in sugar',
        'Beat in eggs one at a time',
        'Add vanilla',
        'Fold in flour, cocoa, salt',
        'Add chocolate chips if using',
        'Pour into pan',
        "Bake 25-30 minutes (don't overbake)",
        'Cool completely before cutting',
      ],
      tips: [
        'Slightly underbake for fudgier brownies',
        'Let cool completely for clean cuts',
        'Store in airtight container',
      ],
    },
    'Crème Brûlée': {
      id: '6',
      name: 'Crème Brûlée',
      category: 'Dessert',
      shortDescription: 'French custard with caramelized sugar',
      prepTime: '50 min',
      calories: '360 kcal',
      ingredients: [
        '2 cups heavy cream',
        '1 vanilla bean (or 2 tsp extract)',
        '5 egg yolks',
        '1/2 cup sugar plus extra for topping',
        'Pinch of salt',
      ],
      instructions: [
        'Preheat oven to 325°F (160°C)',
        'Heat cream with vanilla bean until simmering',
        'Whisk egg yolks with 1/2 cup sugar',
        'Slowly whisk hot cream into eggs',
        'Strain mixture',
        'Pour into ramekins',
        'Place in baking dish, add hot water halfway up sides',
        'Bake 35-40 minutes until set but jiggly',
        'Refrigerate 4 hours',
        'Sprinkle sugar on top, torch until caramelized',
      ],
      tips: [
        'Water bath ensures even cooking',
        'Chill thoroughly before torching',
        'Use a kitchen torch for best caramelization',
      ],
    },
    Hummus: {
      id: '2',
      name: 'Hummus',
      category: 'Mediterranean',
      shortDescription: 'Chickpea dip with tahini and lemon',
      prepTime: '10 min',
      calories: '180 kcal',
      ingredients: [
        '2 cans chickpeas, drained',
        '1/4 cup tahini',
        '3 tbsp lemon juice',
        '2 cloves garlic',
        '3 tbsp olive oil',
        '1/2 tsp cumin',
        'Salt',
        'Paprika for garnish',
        'Fresh parsley',
      ],
      instructions: [
        'Reserve some chickpeas for garnish',
        'Blend chickpeas, tahini, lemon, garlic',
        'Add olive oil while blending',
        'Add cold water for desired consistency',
        'Season with cumin and salt',
        'Transfer to serving bowl',
        'Drizzle with olive oil',
        'Garnish with paprika, chickpeas, parsley',
        'Serve with pita bread',
      ],
      tips: [
        'Remove chickpea skins for ultra-smooth hummus',
        'Add ice water for creamier texture',
        'Adjust lemon and garlic to taste',
      ],
    },
    Falafel: {
      id: '3',
      name: 'Falafel',
      category: 'Mediterranean',
      shortDescription: 'Crispy fried chickpea balls',
      prepTime: '30 min',
      calories: '320 kcal',
      ingredients: [
        '2 cups dried chickpeas, soaked overnight',
        '1 onion, quartered',
        '4 cloves garlic',
        '1 cup fresh parsley',
        '1 cup fresh cilantro',
        '2 tsp cumin',
        '1 tsp coriander',
        '1/2 tsp cayenne',
        '2 tbsp flour',
        '1 tsp baking powder',
        'Salt',
        'Oil for frying',
      ],
      instructions: [
        'Drain chickpeas well',
        'Pulse chickpeas, onion, garlic, herbs in food processor',
        'Add spices, flour, baking powder, salt',
        'Pulse until mixture holds together',
        'Refrigerate 1 hour',
        'Form into small balls or patties',
        'Heat oil to 350°F (175°C)',
        'Fry in batches until golden brown',
        'Drain on paper towels',
        'Serve in pita with tahini sauce',
      ],
      tips: [
        'Use dried chickpeas, not canned',
        "Don't over-process - mixture should be coarse",
        'Chilling helps them hold shape',
      ],
    },
    'Grilled Fish': {
      id: '4',
      name: 'Grilled Fish',
      category: 'Mediterranean',
      shortDescription: 'Fresh fish with lemon and herbs',
      prepTime: '25 min',
      calories: '280 kcal',
      ingredients: [
        '4 fish fillets (sea bass or snapper)',
        '3 tbsp olive oil',
        '2 lemons',
        '4 cloves garlic, minced',
        'Fresh oregano or thyme',
        'Fresh parsley',
        'Salt and pepper',
        'Cherry tomatoes',
      ],
      instructions: [
        'Marinate fish with olive oil, lemon juice, garlic, herbs',
        'Let sit 15 minutes',
        'Preheat grill or grill pan to medium-high',
        'Oil grill grates',
        'Season fish with salt and pepper',
        "Grill 4-5 minutes per side (don't overcook)",
        'Add cherry tomatoes to grill',
        'Squeeze fresh lemon over cooked fish',
        'Garnish with fresh herbs',
      ],
      tips: [
        "Don't flip fish too early - let it develop crust",
        'Fish is done when it flakes easily',
        'Skin-on helps fish stay together',
      ],
    },
    Moussaka: {
      id: '5',
      name: 'Moussaka',
      category: 'Mediterranean',
      shortDescription: 'Layered eggplant casserole',
      prepTime: '90 min',
      calories: '480 kcal',
      ingredients: [
        '3 large eggplants, sliced',
        '500g ground lamb or beef',
        '1 onion, diced',
        '3 cloves garlic',
        '400g crushed tomatoes',
        '2 cups béchamel sauce',
        '1/2 cup Parmesan cheese',
        'Cinnamon',
        'Oregano',
        'Olive oil',
      ],
      instructions: [
        'Salt eggplant slices, let sit 30 minutes, rinse',
        'Brush with oil, bake until soft',
        'Brown meat with onion and garlic',
        'Add tomatoes, cinnamon, oregano, simmer 20 minutes',
        'Make béchamel sauce',
        'Layer: eggplant, meat sauce, eggplant, repeat',
        'Top with béchamel and Parmesan',
        'Bake at 350°F (175°C) for 45 minutes',
        'Let rest 15 minutes before serving',
      ],
      tips: [
        'Salting eggplant removes bitterness',
        'Let it rest for easier slicing',
        'Reheat well - great for leftovers',
      ],
    },
    Baklava: {
      id: '6',
      name: 'Baklava',
      category: 'Mediterranean',
      shortDescription: 'Sweet pastry with nuts and honey',
      prepTime: '60 min',
      calories: '420 kcal',
      ingredients: [
        '1 package phyllo dough',
        '2 cups mixed nuts (walnuts, pistachios), chopped',
        '1 cup butter, melted',
        '1 tsp cinnamon',
        '1 cup sugar',
        '1 cup water',
        '1/2 cup honey',
        '1 tsp vanilla',
        'Lemon juice',
      ],
      instructions: [
        'Preheat oven to 350°F (175°C)',
        'Mix nuts with cinnamon',
        'Brush baking dish with butter',
        'Layer 8 phyllo sheets, brushing each with butter',
        'Sprinkle nut mixture',
        'Repeat layers',
        'Top with 8 more phyllo sheets',
        'Cut into diamonds before baking',
        'Bake 45-50 minutes until golden',
        'Make syrup: boil sugar, water, honey',
        'Pour hot syrup over hot baklava',
        'Cool completely before serving',
      ],
      tips: [
        'Keep phyllo covered with damp towel',
        'Cut before baking for clean pieces',
        'Let syrup soak in overnight',
      ],
    },
    'Vegetable Tempura': {
      id: '4b',
      name: 'Vegetable Tempura',
      category: 'Japanese',
      shortDescription: 'Lightly battered and fried seafood and vegetables',
      prepTime: '30 min',
      calories: '340 kcal',
      ingredients: [
        '200g shrimp, peeled',
        'Assorted vegetables (sweet potato, zucchini, bell pepper)',
        '1 cup flour',
        '1 egg yolk',
        '1 cup ice cold water',
        'Oil for deep frying',
        'Tempura dipping sauce',
        'Grated daikon radish',
      ],
      instructions: [
        'Heat oil to 350°F (175°C)',
        'Mix egg yolk with ice water',
        'Add flour, stir gently (lumps are okay)',
        'Pat shrimp and vegetables dry',
        'Dip in batter, let excess drip off',
        'Fry in batches until light golden (2-3 min)',
        'Drain on paper towels',
        'Serve immediately with dipping sauce and daikon',
      ],
      tips: [
        'Keep batter ice cold for crispy tempura',
        "Don't overmix - lumps are fine",
        'Fry in small batches to maintain oil temperature',
      ],
    },
    'Classic Caesar Salad': {
      id: '1',
      name: 'Classic Caesar Salad',
      category: 'General',
      shortDescription: 'Fresh romaine with parmesan and croutons',
      prepTime: '15 min',
      calories: '280 kcal',
      ingredients: [
        '1 large head romaine lettuce',
        '1/2 cup Parmesan cheese, shaved',
        '1 cup croutons',
        '2 cloves garlic',
        '4 anchovy fillets',
        '1 egg yolk',
        '2 tbsp lemon juice',
        '1 tsp Dijon mustard',
        '1/2 cup olive oil',
        'Black pepper',
      ],
      instructions: [
        'Chop romaine into bite-sized pieces',
        'Make dressing: mash garlic and anchovies',
        'Whisk in egg yolk, lemon juice, mustard',
        'Slowly drizzle in olive oil while whisking',
        'Season with pepper',
        'Toss romaine with dressing',
        'Add Parmesan and croutons',
        'Toss again',
        'Serve immediately',
      ],
      tips: [
        'Use fresh, crisp romaine',
        'Make croutons from stale bread',
        'Classic Caesar has raw egg - use pasteurized if concerned',
      ],
    },
    'Grilled Chicken Breast': {
      id: '2',
      name: 'Grilled Chicken Breast',
      category: 'General',
      shortDescription: 'Juicy herb-seasoned chicken',
      prepTime: '25 min',
      calories: '320 kcal',
      ingredients: [
        '4 chicken breasts',
        '3 tbsp olive oil',
        '2 cloves garlic, minced',
        '1 tsp dried oregano',
        '1 tsp paprika',
        '1/2 tsp thyme',
        'Salt and pepper',
        'Lemon wedges',
      ],
      instructions: [
        'Pound chicken to even thickness',
        'Mix olive oil, garlic, herbs, salt, pepper',
        'Marinate chicken 15 minutes',
        'Preheat grill or grill pan to medium-high',
        'Oil grill grates',
        'Grill chicken 6-7 minutes per side',
        'Check internal temp reaches 165°F',
        'Let rest 5 minutes',
        'Serve with lemon wedges',
      ],
      tips: [
        "Don't overcook - use meat thermometer",
        'Resting keeps chicken juicy',
        'Slice against grain for tender pieces',
      ],
    },
    'Vegetable Stir Fry': {
      id: '3',
      name: 'Vegetable Stir Fry',
      category: 'General',
      shortDescription: 'Colorful mixed vegetables in savory sauce',
      prepTime: '20 min',
      calories: '240 kcal',
      ingredients: [
        '2 cups broccoli florets',
        '1 bell pepper, sliced',
        '1 cup snap peas',
        '1 carrot, sliced',
        '200g mushrooms',
        '3 cloves garlic',
        '1 tbsp ginger',
        '3 tbsp soy sauce',
        '1 tbsp sesame oil',
        '2 tsp cornstarch',
      ],
      instructions: [
        'Mix soy sauce, sesame oil, cornstarch with water',
        'Heat wok over high heat',
        'Add garlic and ginger',
        'Add harder vegetables first',
        'Stir-fry 3 minutes',
        'Add softer vegetables',
        'Stir-fry 2 more minutes',
        'Add sauce',
        'Toss until thickened',
      ],
      tips: ['Keep vegetables crisp', 'High heat is essential', "Don't overcrowd the pan"],
    },
    'Beef Burger': {
      id: '4',
      name: 'Beef Burger',
      category: 'General',
      shortDescription: 'Juicy beef patty with toppings',
      prepTime: '30 min',
      calories: '520 kcal',
      ingredients: [
        '500g ground beef (80/20)',
        '4 burger buns',
        'Salt and pepper',
        '4 cheese slices',
        'Lettuce',
        'Tomato slices',
        'Onion slices',
        'Pickles',
        'Ketchup',
        'Mustard',
        'Mayo',
      ],
      instructions: [
        'Divide beef into 4 portions',
        'Form into patties, make indent in center',
        'Season generously with salt and pepper',
        'Heat grill or pan to high',
        'Cook 4 minutes per side for medium',
        'Add cheese last minute of cooking',
        'Toast buns',
        'Assemble: bun, sauce, lettuce, patty, toppings',
        'Serve immediately',
      ],
      tips: [
        "Don't overwork the meat",
        'Indent prevents puffing up',
        'Let patties come to room temperature',
      ],
    },
    'Pasta Primavera': {
      id: '5',
      name: 'Pasta Primavera',
      category: 'General',
      shortDescription: 'Pasta with fresh seasonal vegetables',
      prepTime: '25 min',
      calories: '380 kcal',
      ingredients: [
        '400g pasta',
        '2 cups broccoli',
        '1 zucchini, sliced',
        '1 bell pepper, sliced',
        '1 cup cherry tomatoes',
        '3 cloves garlic',
        '1/2 cup cream',
        '1/2 cup Parmesan',
        'Olive oil',
        'Fresh basil',
      ],
      instructions: [
        'Cook pasta until al dente',
        'Sauté garlic in olive oil',
        'Add broccoli and peppers, cook 5 minutes',
        'Add zucchini and tomatoes',
        'Cook 3 more minutes',
        'Add cream and Parmesan',
        'Toss with drained pasta',
        'Season to taste',
        'Garnish with basil',
      ],
      tips: [
        'Use seasonal vegetables',
        "Don't overcook vegetables",
        'Add pasta water to thin sauce',
      ],
    },
    'Fruit Salad': {
      id: '6',
      name: 'Fruit Salad',
      category: 'General',
      shortDescription: 'Fresh mixed fruits with honey',
      prepTime: '10 min',
      calories: '150 kcal',
      ingredients: [
        '2 cups strawberries, halved',
        '2 cups pineapple chunks',
        '2 cups grapes',
        '2 oranges, segmented',
        '1 cup blueberries',
        '2 kiwis, sliced',
        '2 tbsp honey',
        'Juice of 1 lime',
        'Fresh mint leaves',
      ],
      instructions: [
        'Prepare all fruits',
        'Combine in large bowl',
        'Mix honey with lime juice',
        'Drizzle over fruit',
        'Toss gently',
        'Chill 30 minutes',
        'Garnish with mint',
        'Serve cold',
      ],
      tips: [
        'Use ripe, seasonal fruit',
        'Add honey-lime dressing just before serving',
        'Great for meal prep',
      ],
    },
  };

  // First check if we have a static recipe
  if (recipes[recipeName]) {
    const englishRecipe = recipes[recipeName];

    // Cache the English version
    setCachedRecipe(recipeName, englishRecipe, 'en');

    // Return English if requested
    if (currentLang === 'en') {
      return englishRecipe;
    }

    // Translate and cache
    try {
      const translated = await translateRecipeContent([englishRecipe], currentLang);
      const translatedRecipe = translated[0];

      // Cache the translation
      setCachedRecipe(recipeName, englishRecipe, currentLang, translatedRecipe);

      return translatedRecipe;
    } catch (error) {
      console.error(
        `[Translation Error] Failed to translate "${recipeName}" to ${currentLang}:`,
        error
      );
      // Fallback to English if translation fails
      return englishRecipe;
    }
  }

  // If not found and AI is available, generate recipe details using Gemini AI
  if (ai) {
    try {
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          category: { type: Type.STRING },
          shortDescription: { type: Type.STRING },
          prepTime: { type: Type.STRING },
          calories: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          instructions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          tips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'id',
          'name',
          'category',
          'shortDescription',
          'prepTime',
          'calories',
          'ingredients',
          'instructions',
          'tips',
        ],
      };

      const prompt = `Generate a complete, detailed recipe for "${recipeName}". 
      Include:
      - A complete list of ingredients with measurements
      - Step-by-step cooking instructions (8-12 steps)
      - 3-4 helpful cooking tips
      - Accurate prep time (format: "X min") and calories (format: "X kcal")
      - Appropriate category (Italian, Japanese, Mexican, Indian, Thai, Vegan, Dessert, Mediterranean, or General)
      
      Make it authentic, detailed, and practical for home cooking.`;

      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const generatedRecipe = JSON.parse(result.text || 'null') as RecipeDetail;

      if (!generatedRecipe) return null;

      // Cache the English version
      setCachedRecipe(recipeName, generatedRecipe, 'en');

      // Return English if requested
      if (currentLang === 'en') {
        return generatedRecipe;
      }

      // Translate and cache
      try {
        const translated = await translateRecipeContent([generatedRecipe], currentLang);
        const translatedRecipe = translated[0];

        // Cache the translation
        setCachedRecipe(recipeName, generatedRecipe, currentLang, translatedRecipe);

        return translatedRecipe;
      } catch (error) {
        console.error(
          `[Translation Error] Failed to translate generated recipe "${recipeName}" to ${currentLang}:`,
          error
        );
        // Fallback to English if translation fails
        return generatedRecipe;
      }
    } catch (error) {
      console.error('Error generating recipe details with AI:', error);
      return null;
    }
  }

  return null;
};
