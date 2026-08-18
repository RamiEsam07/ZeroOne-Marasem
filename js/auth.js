/** ZEROONE MARASEM — Authentication & Role Resolution */
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let currentUser=null, currentRole=null, currentAdminName=null, guardStarted=false;
const ROLE_LABELS={admin:"مدير النظام",manager:"مدير المناسبة",staff:"فريق الاستقبال",viewer:"مشاهدة فقط"};
const PERMISSIONS={
 admin:{manageGuests:true,delivery:true,checkin:true,analytics:true,deleteGuest:true,manageRoles:true},
 manager:{manageGuests:true,delivery:true,checkin:true,analytics:true,deleteGuest:false,manageRoles:false},
 staff:{manageGuests:false,delivery:false,checkin:true,analytics:false,deleteGuest:false,manageRoles:false},
 viewer:{manageGuests:false,delivery:false,checkin:false,analytics:true,deleteGuest:false,manageRoles:false}
};
export function can(p){return !!(currentRole&&PERMISSIONS[currentRole]?.[p]);}
export function getCurrentRole(){return currentRole;}
export function getCurrentAdminName(){return currentAdminName;}
export function getRoleLabel(r){return ROLE_LABELS[r]||r;}
function clearState(){currentUser=null;currentRole=null;currentAdminName=null;}
function hideDashboard(){if(document.body)document.body.style.visibility="hidden";}
function showDashboard(){if(document.body)document.body.style.visibility="visible";}
function goLogin(){clearState();window.location.replace("./login.html");}
async function resolveRole(user){
 if(!user?.uid){const e=new Error("AUTH_USER_MISSING");e.code="AUTH_USER_MISSING";throw e;}
 const snap=await getDoc(doc(db,"admins",user.uid));
 if(!snap.exists()){const e=new Error(`ADMIN_DOCUMENT_NOT_FOUND: admins/${user.uid}`);e.code="ADMIN_DOCUMENT_NOT_FOUND";throw e;}
 const data=snap.data()||{}, role=String(data.role||"").trim().toLowerCase();
 if(!PERMISSIONS[role]){const e=new Error(`INVALID_ADMIN_ROLE: ${data.role||"missing"}`);e.code="INVALID_ADMIN_ROLE";throw e;}
 currentUser=user;currentRole=role;currentAdminName=data.name||user.displayName||user.email||"Admin";return true;
}
export async function loginAdmin(email,password){
 const cred=await signInWithEmailAndPassword(auth,email,password);
 try{await resolveRole(cred.user);return cred.user;}catch(e){try{await signOut(auth);}catch(_){}clearState();throw e;}
}
export async function logoutAdmin(){clearState();try{await signOut(auth);}finally{window.location.replace("./login.html");}}
export function guardAdminPage(onReady,onDenied){
 hideDashboard();
 if(guardStarted)return;guardStarted=true;
 let readyUid=null;
 const deny=async e=>{console.error("[MARASEM AUTH] Authorization failed:",e);clearState();try{if(auth.currentUser)await signOut(auth);}catch(_){}
  if(typeof onDenied==="function"){onDenied(e);return;} goLogin();};
 const check=async user=>{
  if(!user){goLogin();return;}
  try{await resolveRole(user);showDashboard();if(readyUid!==user.uid){readyUid=user.uid;if(typeof onReady==="function")onReady(user,currentRole);}}
  catch(e){await deny(e);}
 };
 onAuthStateChanged(auth,check);
 window.addEventListener("pageshow",e=>{if(e.persisted){hideDashboard();check(auth.currentUser);}});
}
window.MARASEM_AUTH={loginAdmin,logoutAdmin,guardAdminPage,can,getCurrentRole,getCurrentAdminName,getRoleLabel};
