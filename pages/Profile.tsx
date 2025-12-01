
import React, { useState } from 'react';
import { User } from '../types';
import { Button, Input, Card, Badge, Icons } from '../components/UI';
import { apiUpdateProfile } from '../services/mockBackend';
import { INTERESTS } from '../constants';

interface ProfileProps {
  user: User;
  onBack: () => void;
  onUpdate: (user: User) => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onBack, onUpdate }) => {
  const [bio, setBio] = useState(user.bio || '');
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || '');
  const [age, setAge] = useState(user.age.toString());
  const [selectedInterests, setSelectedInterests] = useState<string[]>(user.interests || []);
  const [loading, setLoading] = useState(false);

  const toggleInterest = (tag: string) => {
      if (selectedInterests.includes(tag)) {
          setSelectedInterests(prev => prev.filter(i => i !== tag));
      } else {
          if (selectedInterests.length >= 5) {
              alert("You can select up to 5 interests.");
              return;
          }
          setSelectedInterests(prev => [...prev, tag]);
      }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
        const updated = await apiUpdateProfile(user.id, { 
            bio, 
            photoUrl,
            age: parseInt(age),
            interests: selectedInterests
        });
        onUpdate(updated);
        onBack();
    } catch(e) {
        alert('Failed to update profile');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-12">
        <div className="max-w-md mx-auto">
            <button onClick={onBack} className="flex items-center text-gray-500 mb-6 hover:text-gray-900 font-medium transition-colors">
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                Back to Dashboard
            </button>
            
            <h1 className="text-3xl font-black text-gray-900 mb-6">Edit Profile</h1>

            <Card className="space-y-8">
                <div className="text-center">
                    <div className="relative inline-block">
                        <img 
                            src={photoUrl || 'https://via.placeholder.com/150'} 
                            alt="Preview" 
                            className="w-28 h-28 rounded-full object-cover border-4 border-gray-100 shadow-lg"
                        />
                        <div className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full shadow-md border border-gray-100">
                             <Icons.User className="w-4 h-4 text-gray-500" />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <Input 
                        label="Profile Photo URL" 
                        value={photoUrl} 
                        onChange={e => setPhotoUrl(e.target.value)} 
                        placeholder="https://..." 
                    />

                    <Input 
                        label="Age" 
                        type="number"
                        value={age} 
                        onChange={e => setAge(e.target.value)} 
                        min="13"
                        max="99"
                        required
                    />

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">About You</label>
                        <textarea 
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 focus:bg-white focus:border-nepaliRed/50 focus:ring-4 focus:ring-nepaliRed/10 outline-none h-32 resize-none transition-all"
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder="What makes you unique? Keep it short & sweet."
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 ml-1">
                            Interests <span className="text-gray-400 font-normal normal-case ml-1">(Max 5)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {INTERESTS.map(tag => (
                                <Badge 
                                    key={tag} 
                                    active={selectedInterests.includes(tag)}
                                    onClick={() => toggleInterest(tag)}
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <Button onClick={handleSave} fullWidth isLoading={loading} className="shadow-xl">
                        Save Changes
                    </Button>
                </div>
            </Card>
        </div>
    </div>
  );
};
