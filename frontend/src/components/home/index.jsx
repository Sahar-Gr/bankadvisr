import React from "react";
import { useAuth } from "../../contexts/authContext";

const Home = () => {
    const { currentUser} = useAuth()
    return (
        <div >
            Home {currentUser.displayName ? currentUser.displayName : currentUser.email}
        </div>
    )
}

export default Home