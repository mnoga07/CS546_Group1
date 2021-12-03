const express = require('express');
const router = express.Router();
const user_DAL = require('../data/users');
const manager_DAL = require('../data/managers');
const path = require('path');

router.get('/', async (req, res) => {
    if (req.session.user){
        return res.redirect('/restaurants')
    }
    
    res.render('forms/LoginForm', {title: "Login", page_function: "Log into an account NOW"})
});

router.post('/', async (req, res) => {
    const loginForm = req.body
    if (!loginForm.username 
        || loginForm.username.includes(' ') 
        || !loginForm.username.match(/^[0-9a-zA-Z]+$/) 
        || loginForm.username.length < 4){

        res.status(400).render('/login', {title: "Login", page_function: "Log into an account NOW", error: "Username invalid!"})    
        return
    }
    if (!loginForm.password || loginForm.password.includes(' ') || loginForm.password.length<6){
        res.status(400).render('/login', {title: "Login", page_function: "Log into an account NOW", error: "Password invalid!"})    
        return
    }

    
    if(await user_DAL.checkUser(loginForm.username, loginForm.password)){
        req.session.user = { username: loginForm.username, accountType: 'user' };
        res.redirect('/restaurants')
        return
    }
    else if(await manager_DAL.checkManager(loginForm.username, loginForm.password)){
        req.session.user = { username: loginForm.username, accountType: 'manager' };
        res.redirect('/restaurants')
        return
    }
    
    res.status(500).render('/login', {title: "Login", page_function: "Log into an account NOW", error: 'Internal Server Error'})
    return

});

module.exports = router;