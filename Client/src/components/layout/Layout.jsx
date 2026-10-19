import Navbar from './Navbar';
import Footer from './Footer';

const Layout = ({ children }) => {
    return (
        <div className="app-layout">
            <Navbar />

            <main className="main-content">
                {children}
            </main>

            <Footer />
        </div>
    );
};

export default Layout;