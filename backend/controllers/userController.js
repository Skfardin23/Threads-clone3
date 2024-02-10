import User from "../models/UserModel.js";
import Post from "../models/PostModel.js";
import bcrypt from "bcryptjs"
import generateTokensAndSetCookie from "../utils/helpers/generateTokenAndSetCookie.js";
import {v2 as cloudinary} from "cloudinary";
import mongoose from 'mongoose';


const getUserProfile = async (req, res) => {
    const { query } = req.params;
    //we will fetch user profile either with username or UserId
    //query is either username or userId
    try{
  let user;
  //query is userId
  if(mongoose.Types.ObjectId.isValid(query)){
    user = await User.findOne({_id: query }).select("-password").select("-updateAt");
  }else{
     user = await User.findOne({ username:query }).select("-password").select("-updateAt");
  }

    if(user){
        res.status(200).json(user);
    }else{
        res.status(400).json({
            error: "User not found"
        });
    }


    }catch(err) {
        res.status(500).json({
            error: err.message
        });
        console.log("Error in the message: ",err.message);
    }
}

const signupUser = async (req, res) => {
    try{
      const { name,email,username,password} = req.body;
      const user = await User.findOne({$or:[{email},{username}]});
      if(user){
        return res.status(400).json({
            error: "User already exists"
        });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = new  User({
        name,
        email,
        username,
        password:hashedPassword,
      });
      await newUser.save();

      if(newUser){
        generateTokensAndSetCookie(newUser._id, res);
        res.status(201).json({
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          username: newUser.username,
          bio: newUser.bio,
          profilePic: newUser.profilePic,
        });
      }else{
        res.status(400).json({error:"Invalid userdata"
      });
    }
    } catch(err){
        res.status(500).json({
            error: err.message
        });
        console.log("Error in the message: ",err.message)
    }
};

const loginUser = async (req, res) => {
try{
    const { username, password} = req.body;
   const user = await User.findOne({ username});
   const isPasswordCorrect = await bcrypt.compare(password,user?.password || "");
   if(!user || !isPasswordCorrect){
    return res.status(400).json({
        error: "Invalid username or password"
    });
   }
   generateTokensAndSetCookie(user._id, res);
   res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    username: user.username,
    bio: user.bio,
    profilePic: user.profilePic,
   });
}catch(error){
    res.status(500).json({
        error: error.message
    });
    console.log("Error in the message: ",error.message)
}
};
 
const logoutUser = (req, res) => {
    try{
        res.cookie("jwt","",{maxage:1});
        res.status(200).json({
            message: "Successfully logged out"
        });

    }catch(error){
        res.status(500).json({
            error: error.message
        });
        console.log("Error in signupuser: ",error.message)
    }
};

const follownUnFollowUser = async(req, res) => {
    try{
    const { id } = req.params;
    const userToModify = await User.findById(id);
    const currentUser = await User.findById(req.user._id);
    if(id === req.user._id.toString()) return res.status(400).json({error: "you cannot follow/unfollow yourself"});
    if(!userToModify || !currentUser) return res.status(404).json({error: "user not found"});

    const isFollowing = currentUser.following.includes(id);

    if(isFollowing){
    //unfollow usr
    //Modify current user following , modify followers of userToModify
    await User.findByIdAndUpdate(req.user._id, { $pull: {following: id}});
    await User.findByIdAndUpdate(id, { $pull: {followers: req.user._id}});
    res.status(200).json({message: "User unfollowed successfully"});
    }else{
   // follow user
   await User.findByIdAndUpdate(id, {$push: {followers: req.user._id}});
   await User.findByIdAndUpdate(req.user._id, {$push: {following: id}});
   res.status(200).json({message: "User followed successfully"});
    }
    }catch(error){
        res.status(500).json({
            error: error.message
        });
        console.log("Error in follow/unfollow user ",error.message)
    }
}

const updateUser = async (req,res) => {
   
    const {name, email, username, password,  bio } = req.body;
    let { profilePic } = req.body;
    const userId = req.user._id;
    try{
     let user = await User.findById(userId);
     if(!user) return res.status(404).json({error: "user not found"});

     if(req.params.id !== userId.toString()) return res.status(400).json({error: "you cannot update other user's profile"});

     if(password){
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        user.password = hashedPassword;
     }

     if(profilePic){
        if(user.profilePic){
            await cloudinary.uploader.destroy(user.profilePic.split("/").pop().split(".")[0]);
        }
        const uploadedResponse = await cloudinary.uploader.upload(profilePic);
        profilePic = uploadedResponse.secure_url;
     }
     user.name = name || user.name;
     user.email = email || user.email;
     user.username = username || user.username;
     user.profilePic = profilePic || user.profilePic;
     user.bio = bio || user.bio;

     user = await user.save();
    await Post.updateMany(
        {"replies.userId":userId},
        {
            $set:{
                "replies.$[reply].username":user.username,
                "replies.$[reply].userProfilePic":user.profilePic,
            },
        },
        {arrayFilters:[{"reply.userId":userId}] }
    );


   user.password =  null;
     res.status(200).json(user);
    }catch  (error) {
        res.status(500).json({
            error: error.message
        });
        console.log("Error in updateUser: ",error.message)
    }
}

export { signupUser, loginUser, logoutUser, follownUnFollowUser, updateUser, getUserProfile};