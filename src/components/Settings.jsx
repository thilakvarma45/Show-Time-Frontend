import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, MapPin, Camera, Save, ArrowLeft, Bell, Shield, Eye, CreditCard, ChevronRight } from 'lucide-react';
import { getInitials } from '../utils/formatters';
import { toast } from 'react-toastify';

const Settings = ({ user, onBack, onSave }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || '',
    profileImageUrl: user?.profileImageUrl || '',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setIsEditing(true);
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      setProfileImageFile(file);
      setIsEditing(true);
    }
  };

  const uploadProfileImage = async () => {
    if (!profileImageFile || !user?.id) return null;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', profileImageFile);

      const token = localStorage.getItem('token');
      const response = await fetch(`https://show-time-backend-production.up.railway.app/api/upload/profile/${user.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      return `https://show-time-backend-production.up.railway.app${data.imageUrl}`;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload profile image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let updatedData = { ...formData };

    // Upload profile image if selected
    if (profileImageFile) {
      const imageUrl = await uploadProfileImage();
      if (imageUrl) {
        updatedData.profileImageUrl = imageUrl;
      }
    }

    // Update user profile via API
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://show-time-backend-production.up.railway.app/api/auth/user/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedUser = await response.json();
      onSave(updatedUser);
      setFormData({
        ...updatedData,
        profileImageUrl: updatedUser.profileImageUrl || updatedData.profileImageUrl,
      });
      setIsEditing(false);
      setProfileImageFile(null);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };


  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:px-12">

        {/* Header Navigation */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-16"
        >
          <button
            onClick={onBack}
            className="group flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center group-hover:border-slate-400 group-hover:bg-slate-50 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight">Back to Dashboard</span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

          {/* Sidebar / Profile Summary */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-4 space-y-8"
          >
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Settings</h1>
              <p className="text-slate-500 font-medium">Manage your personal info and preferences.</p>
            </div>

            {/* Avatar Section */}
            <div className="relative group w-fit">
              <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden bg-slate-50 border-4 border-slate-100 shadow-xl relative">
                {formData.profileImageUrl || profileImageFile ? (
                  <img
                    src={profileImageFile ? URL.createObjectURL(profileImageFile) : formData.profileImageUrl}
                    alt={formData.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                    <User className="w-16 h-16" />
                  </div>
                )}
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                  <Camera className="w-8 h-8 text-white drop-shadow-md" />
                </div>
              </div>
              <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer">
                <Camera className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Quick Menu (Visual Only for now) */}
            <div className="hidden lg:block space-y-1 pt-8">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 text-slate-900 font-bold border border-slate-100">
                <span className="flex items-center gap-3"><User className="w-5 h-5" /> Profile</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </motion.div>

          {/* Main Form Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8"
          >
            <form onSubmit={handleSubmit} className="space-y-12">

              {/* Section: Personal Info */}
              <section>
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  Personal Information
                  <div className="h-px flex-1 bg-slate-100 ml-4"></div>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                      placeholder="Enter full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                      placeholder="City, Country"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Bio</label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows={3}
                      className="w-full p-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none resize-none"
                      placeholder="Brief description for your profile..."
                    />
                  </div>
                </div>
              </section>

              {/* Section: Contact */}
              <section>
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  Contact Details
                  <div className="h-px flex-1 bg-slate-100 ml-4"></div>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-semibold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-8 py-4 rounded-xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isEditing || uploadingImage}
                  className={`flex-1 md:flex-none md:w-48 px-8 py-4 rounded-xl font-bold text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 ${isEditing && !uploadingImage
                    ? 'bg-black hover:bg-slate-800'
                    : 'bg-slate-300 cursor-not-allowed'
                    }`}
                >
                  <Save className="w-5 h-5" />
                  {uploadingImage ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

            </form>
          </motion.div>

        </div>
      </div>
    </div>
  );
};

export default Settings;

