import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { isSignedIn, SESSION_ENDED } from './api';
import { ListeDeMariage } from './ListeDeMariage/ListeDeMariage';
import { Login } from './ListeDeMariage/Login';

/* The list is only for the signed-in couple; anyone else goes to the sign-in page. */
function RequireSession({ children }) {
    const location = useLocation();
    if (!isSignedIn()) return <Navigate to="/login" replace state={{ from: location }} />;
    return children;
}

function App() {
    const navigate = useNavigate();

    // Token lapsed or rejected: back to sign-in, with a note explaining why.
    useEffect(() => {
        const onEnded = () => navigate('/login', { replace: true, state: { expired: true } });
        window.addEventListener(SESSION_ENDED, onEnded);
        return () => window.removeEventListener(SESSION_ENDED, onEnded);
    }, [navigate]);

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/liste-de-mariage" element={<RequireSession><ListeDeMariage /></RequireSession>} />
            {/* Every other address, including "/", lands on the gift list (or sign-in). */}
            <Route path="*" element={<Navigate to="/liste-de-mariage" replace />} />
        </Routes>
    );
}

export default App;
