import mongoose from 'mongoose';
import { connectDB } from './mongodb';

// Import all models
import User from '@/models/User';
import Summary from '@/models/Summary';
import Campaign from '@/models/Campaign';
import { SessionState } from '@/models/SessionState';

// Ensure models are registered
export async function registerModels() {
  await connectDB();
  
  // Register models if they haven't been registered yet
  if (!mongoose.models.User) {
    mongoose.model('User', User.schema);
  }
  if (!mongoose.models.Summary) {
    mongoose.model('Summary', Summary.schema);
  }
  if (!mongoose.models.Campaign) {
    mongoose.model('Campaign', Campaign.schema);
  }
  if (!mongoose.models.SessionState) {
    mongoose.model('SessionState', SessionState.schema);
  }
}

// Export models
export { User, Summary, Campaign, SessionState }; 