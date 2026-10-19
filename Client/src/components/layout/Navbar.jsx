import { Link } from 'react-router-dom';

const Navbar = () => {
    return (
        <header className="site-header">
            <nav className="navbar">
              <Link to="/" className="navbar-brand">
    <img
        src="/logo.png"
        alt="Big Sammy Groceries"
        className="navbar-logo"
    />
    </Link>

                <div className="navbar-links">
    <Link to="/">Home</Link>
    <Link to="/products">Shop</Link>
    <Link to="/products">Categories</Link>
    <Link to="/products">Deals</Link>
</div>

                <div className="navbar-search">
                    <span>⌕</span>
                    <input
                        type="text"
                        placeholder="Search groceries..."
                    />
                </div>

                <div className="navbar-actions">
                    <Link to="/login" className="navbar-account">
                        Account
                    </Link>

                    <Link to="/cart" className="navbar-cart">
                        <span>Cart</span>
                        <strong>0</strong>
                    </Link>
                </div>
            </nav>
        </header>
    );
};

export default Navbar;