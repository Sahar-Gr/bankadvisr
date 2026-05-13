import React from "react";
import { link , useNavigate } from 'react-router-dom'
import { useAuth } from "../../contexts/authContext";
const Header = () => {
    const navigate = useNavigate()
    const { userLoggedIn } = useAuth()
    return("OK")
}

export default Header