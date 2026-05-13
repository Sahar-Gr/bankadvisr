import { useContext, useEffect, useState } from "react";
import { auth } from "../../firebase/firebase";
import { initializeApp } from "firebase/app";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = React.createContext();

export function useAuth(){
    return useContext(AuthContext);
}

export function AuthProvider({ children}){
    const [ currentuser, setCurrentUser] = useState(null);
    const [ userLoggedIn, setUserLoggedIn] = useState(false);
    const [ loading, setLoading] = useState(true);
    useEffect(()=>{
        const unsubscribe = onAuthStateChanged(auth, initializeUser);
        return unsubscribe;

    }, [])

    async function initialiseUser(user) {
        if (user){
            setCurrentUser({...user});
            setUserLoggedIn(true);
        }else{
            setCurrentUser(null);
            setUserLoggedIn(false);
        }
        setLoading(false);

    }
    const value = {
        currentuser,
        userLoggedIn,
        loading
    }
    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
            </AuthContext.Provider>
        )

}