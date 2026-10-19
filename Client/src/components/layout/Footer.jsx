const Footer = () => {
    return (
        <footer className="site-footer">
            <div className="footer-content">
                <div>
                    <h3>Big Sammy Groceries</h3>
                    <p>
                        Fresh groceries and everyday essentials
                        delivered to your door.
                    </p>
                </div>

                <div>
                    <h4>Quick Links</h4>
                    <p>Home</p>
                    <p>Products</p>
                    <p>Contact</p>
                </div>

                <div>
                    <h4>Customer Support</h4>
                    <p>FAQs</p>
                    <p>Delivery Information</p>
                    <p>Payment Information</p>
                </div>
            </div>

            <div className="footer-bottom">
                <p>
                    © {new Date().getFullYear()} Big Sammy Groceries.
                    All rights reserved.
                </p>
            </div>
        </footer>
    );
};

export default Footer;