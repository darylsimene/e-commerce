const User = require('../models/User');
const crypto = require('crypto')

const getUsers = async(req, res, next) => {
    const filter = {}; //filters to return only selected fields
    const options = {}; //sorting/pagination
    
    if(Object.keys(req.query).length){
        //query parameter

        const{
            userName,
            email,
            password,
            firstName,
            lastName,
            gender,
            limit,
            sortByFirstName
        } = req.query

        if(userName) filter.userName = true
        if(email) filter.email = true
        if(password) filter.password = true
        if(firstName) filter.firstName = true
        if(lastName) filter.lastName = true
        if(gender) filter.gender = true
        if(limit) options.limit = limit;
        if(sortByFirstName) options.sort = {
            firstName: sortByFirstName === 'asc'?1:-1
        }
    }
    
    try{
        const users = await User.find({},filter, options)

        res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json(users)

    } catch (err){
        throw new Error(`ERROR RETRIEVING USERS: ${err.message}`); 
    }
}

const postUser = async(req, res, next) => {
    try{
        const user = await User.create(req.body)

        sendTokenResponse(user, 201, res)
    } catch (err){
        throw new Error(`ERROR POSTING USER: ${err.message}`)
    } 
}

const deleteUsers = async (req, res, next) => {
    try{
        await User.deleteMany();

        res
        .status(200)
        .setHeader('Content-Type', 'applicaton/json')
        .json({ success: true, msg: 'succesfully deleted all users!' })
    } catch(err){
        throw new Error(`ERROR DELETING USERS: ${err.message}`)
    }
}

const getUser = async(req, res, next) => {
    try{
        const user = await User.findById(req.params.userId)

        res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json(user)
    } catch(err){
        throw new Error(`ERROR GETTING USER ${req.params.userId}: ${err.message}`)
    }
}

const updateUser = async (req, res, next) => {
    try{
        const user = await User.findByIdAndUpdate(req.params.userId, {$set: req.body}, {new: true }); 
        
        res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json(user)

    } catch(err){
        throw new Error(`ERROR UPDATING USER  ${req.params.userId}: ${err.message}`)
    }
}

const deleteUser = async (req, res, next) => {
    try {
        await User.findByIdAndDelete(req.params.userId);

        res
        .status(200)
        .setHeader('Content-Type', 'application/json')
        .json({ success: true, msg: `User with id ${req.params.userId} has been deleted!` })
    } catch (err) {
        throw new Error(`ERROR DELETING USER ${req.params.userId}: ${err.message}`)
    }
}

//for login method
const login = async (req, res, next) => {
    const {email,password} = req.body;

    if (!email || !password) throw new Error('Enter email and pw')

    //find a user by email
    const user = await User.findOne({email}).select('+password');

    //check to see if the user is returned
    if (!user) throw new Error ('Invalid Credentials')
    
    //check if the password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) throw new Error('Invalid Credential')
    
    sendTokenResponse(user, 200, res)
}

const forgotPassword = async(req,res,next) => {
    const{email} = req.body
    const user = await User.findOne({email})

    if(!user) throw new Error(`NO USER FOUND`)

    const resetToken = user.getResetPasswordToken();

    try {
        await user.save({validateBeforeSave: false});

        res
        .status(200)
        .setHeader('Content-Type','application/json')
        .json({
            success: true,
            msg: `YOU CAN RESET PW WITH TOKEN: ${resetToken}`
        })
        
    } catch (error) {
        user.resetPasswordToken = undefined
        user.resetPasswordExpire = undefined
        await user.save({validateBeforeSave: false});
        throw new Error(`FAILED TO SAVE PASSWORD TOKEN`)
    }
}

const resetPassword = async(req, res, next) => { 
    const resetPasswordToken = crypto.createHash('sha256').update(req.query.resetToken).digest('hex');

    const user= await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: {$gt: Date.now()}
    })

    if (!user) throw new Error(`Invalid Token`);

    user.password = req.body.password
    user.resetPasswordExpire = undefined;
    user.resetPasswordExpire = undefined;

    await user.save()

    sendTokenResponse(user, 200, res)
}

const updatePassword = async(req, res, next) =>{
    const user = await User.findById(req.user.id).select('+password')

    if (!user) throw new Error(`Invalid Credentials`)

    const passwordMatches = await user.matchPassword(req.body.password)

    if(!passwordMatches) throw new Error(`Password is incorrect`)

    await user.save()

    sendTokenResponse(user, 200, res);
}

const logout = async(req, res, next) => {
    res
    .status(200)
    .cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    })
    .json({success: true, msg: "Successfully logged out!"})
}

const sendTokenResponse = (user, statusCode, res) => {
    const token = user.getSignedJwtToken();

    const options = {
        // set expiration for cookie to be ~2 hrs
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true // security to hide/encrypt payload
    }

    if(process.env.NODE_ENV === 'production') options.secure= true;

    res
    .status(statusCode)
    .cookie('token', token, options)
    .json({success:true, token})
}



module.exports = {
    getUsers,
    postUser,
    deleteUsers,
    getUser,
    updateUser,
    deleteUser,
    login,
    forgotPassword,
    resetPassword,
    updatePassword,
    logout
}