import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";



export const doCreateUserWithEmailAndPassword = async (EmailAuthCredential, password) => {
    return createUserWithEmailAndPassword(auth, EmailAuthCredential, password);

};
