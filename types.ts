export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface RecipeSummary {
  id: string;
  name: string;
  category: string;
  shortDescription: string;
  prepTime: string;
  calories: string;
}

export interface RecipeDetail extends RecipeSummary {
  ingredients: string[];
  instructions: string[];
  tips: string[];
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}
