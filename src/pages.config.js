/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AllLoanersUnfiltered from './pages/AllLoanersUnfiltered';
import Dashboard from './pages/Dashboard';
import ImportData from './pages/ImportData';
import LoanerDetail from './pages/LoanerDetail';
import Marketplace from './pages/Marketplace';
import MyAccount from './pages/MyAccount';
import MyLoaners from './pages/MyLoaners';
import MyMissingParts from './pages/MyMissingParts';
import Search from './pages/Search';
import SendBackLog from './pages/SendBackLog';
import NotificationPreferences from './pages/NotificationPreferences';
import Analytics from './pages/Analytics';
import TerritoryInventory from './pages/TerritoryInventory';
import Calendar from './pages/Calendar';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AllLoanersUnfiltered": AllLoanersUnfiltered,
    "Dashboard": Dashboard,
    "ImportData": ImportData,
    "LoanerDetail": LoanerDetail,
    "Marketplace": Marketplace,
    "MyAccount": MyAccount,
    "MyLoaners": MyLoaners,
    "MyMissingParts": MyMissingParts,
    "Search": Search,
    "SendBackLog": SendBackLog,
    "NotificationPreferences": NotificationPreferences,
    "Analytics": Analytics,
    "TerritoryInventory": TerritoryInventory,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};