import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getCategories } from "../services/categoryService";

import api from "../services/api";

import "../styles/categories.css";

const Home = () => {
  const [categories, setCategories] = useState([]);

  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [categoriesError, setCategoriesError] = useState("");

  const [products, setProducts] = useState([]);

  const [productsLoading, setProductsLoading] = useState(true);

  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const result = await getCategories();

        setCategories(
          (result.data || []).filter((category) => category.is_active),
        );
      } catch (error) {
        console.error("Failed to load categories:", error);

        setCategoriesError("Unable to load categories.");
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
       const response = await api.get("/products?featured=true");

        setProducts(response.data.data || []);
      } catch (error) {
        console.error("Failed to load products:", error);

        setProductsError("Unable to load products.");
      } finally {
        setProductsLoading(false);
      }
    };

    loadProducts();
  }, []);

  return (
    <div className="home-page">
           {" "}
      <section className="announcement-bar" aria-label="Store highlights">
               {" "}
        <div className="announcement-inner">
                   {" "}
          <span className="announcement-item">
                       {" "}
            <span className="announcement-dot" aria-hidden="true">
                      {" "}
            </span>
                Good food. Great value. Your everyday groceries, made easier.  
                 {" "}
          </span>
                   {" "}
          <span className="announcement-divider" aria-hidden="true">
                                {" "}
          </span>
                   {" "}
          <span className="announcement-item">                      </span>     
           {" "}
        </div>
             {" "}
      </section>
           {" "}
      <section className="hero-section">
               {" "}
        <div className="hero-content">
                   {" "}
          <span className="hero-eyebrow">
                      EVERYDAY VALUE • TRUSTED SERVICE          {" "}
          </span>
                   {" "}
          <h1>
            Your kitchen favourites,    <br />    
                    
            just a click away.        {" "}
          </h1>
                   {" "}
          <p>
              Shop quality groceries and everyday essentials at Big
            Sammy, where freshness, value, and convenience come together.      
               {" "}
          </p>
                   {" "}
          <div className="hero-actions">
                       {" "}
            <Link to="/products" className="primary-button">
                            Shop Now <span aria-hidden="true">→</span>         
               {" "}
            </Link>
                       {" "}
            <Link to="/products" className="secondary-button">
                            Explore Products            {" "}
            </Link>
                     {" "}
          </div>
                   {" "}
          <div className="hero-trust">
                       {" "}
            <div>
                            <strong>Local staples</strong>             {" "}
              <span>Everyday Nigerian essentials</span>           {" "}
            </div>
                       {" "}
            <div>
                            <strong>Easy shopping</strong>             {" "}
              <span>Browse from home</span>           {" "}
            </div>
                       {" "}
            <div>
                            <strong>Dependable service</strong>             {" "}
              <span>Convenience you can count on</span>           {" "}
            </div>
                     {" "}
          </div>
                 {" "}
        </div>
               
        <div className="hero-visual">
                 
        </div>
             
      </section>
          
      <section className="home-section categories-section">
              
        <div className="section-heading">
                   
          <div>
                        <span>SHOP BY CATEGORY</span>          
            <h2>Find what you need</h2>         
          </div>
                    <Link to="/products">View all →</Link>     
        </div>
               
        {categoriesLoading ? (
          <div className="category-loading">Loading categories...</div>
        ) : categoriesError ? (
          <div className="category-error">{categoriesError}</div>
        ) : categories.length === 0 ? (
          <div className="category-empty">No categories available yet.</div>
        ) : (
          <div className="category-grid">
                       {" "}
            {categories.map((category) => (
              <Link
                to={`/products?category=${category.id}`}
                className="category-card"
                key={category.id}
              >
                               {" "}
                <div className="category-card-image">
                                   {" "}
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} />
                  ) : (
                    <div className="category-image-placeholder">
                                            <span>{category.name}</span>       
                                 {" "}
                    </div>
                  )}
                                    <div className="category-image-overlay" /> 
                               {" "}
                </div>
                               {" "}
                <div className="category-card-content">
                                    <h3>{category.name}</h3>                 {" "}
                  <p>
                                       {" "}
                    {category.description ||
                      "Explore products in this category."}
                                     {" "}
                  </p>
                                   {" "}
                  <small>
                                        {category.product_count} product        
                                {category.product_count !== 1 ? "s" : ""}       
                             {" "}
                  </small>
                                 {" "}
                </div>
                                <span className="category-arrow">→</span>       
                     {" "}
              </Link>
            ))}
                     {" "}
          </div>
        )}
             {" "}
      </section>
           {" "}
      <section className="promo-banner">
               {" "}
        <div className="promo-banner-content">
                   {" "}
          <span className="promo-eyebrow">GOOD FOOD, ROOTED IN HOME</span>     
             {" "}
          <h2>
              Your local staples. <br/> 
           Your everyday kitchen. {" "}
          </h2>
                   {" "}
          <p>
            From familiar Nigerian food essentials to the things
            your home needs every day, make Big Sammy part of your
            shopping routine.   {" "}
          </p>
                   {" "}
          <Link to="/products" className="promo-button">
                        Shop Nigerian Staples <span aria-hidden="true">→</span> 
                   {" "}
          </Link>
                 {" "}
        </div>
               {" "}
        <div className="promo-banner-visual" aria-hidden="true">
                   {" "}
          <img
            src="/images/nigerian-local-food-spread.jpg"
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";

              event.currentTarget.parentElement.classList.add(
                "promo-image-unavailable",
              );
            }}
          />
                   {" "}
          <div className="promo-image-caption">
                        <span>THE EVERYDAY NIGERIAN KITCHEN</span>           {" "}
            <strong>Local food. Familiar goodness.</strong>         {" "}
          </div>
                 {" "}
        </div>
             {" "}
      </section>
           {" "}
      <section className="home-section featured-section">
               {" "}
        <div className="section-heading">
                   {" "}
          <div>
                        <span>FEATURED PRODUCTS</span>           {" "}
            <h2>Popular right now</h2>         {" "}
          </div>
                    <Link to="/products">View all →</Link>       {" "}
        </div>
               {" "}
        {productsLoading ? (
          <div className="products-message">Loading products...</div>
        ) : productsError ? (
          <div className="products-message">{productsError}</div>
        ) : products.length === 0 ? (
          <div className="products-message">
                        <p>No products are available yet.</p>           {" "}
            <Link to="/products" className="primary-button">
                            Browse Products            {" "}
            </Link>
                     {" "}
          </div>
        ) : (
          <div className="product-grid">
                       {" "}
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                               {" "}
                <Link
                  to={`/products/${product.id}`}
                  className="product-card-image"
                >
                                   {" "}
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";

                        event.currentTarget.parentElement.querySelector(
                          ".image-fallback",
                        ).style.display = "flex";
                      }}
                    />
                  ) : null}
                                   {" "}
                  <span
                    className="image-fallback"
                    style={{
                      display: product.image_url ? "none" : "flex",

                      alignItems: "center",

                      justifyContent: "center",

                      width: "100%",

                      height: "100%",
                    }}
                  >
                                        Image coming soon                  {" "}
                  </span>
                                 {" "}
                </Link>
                               {" "}
                <div className="product-card-content">
                                   {" "}
                  <span className="product-category">
                                        {product.category_name}               
                     {" "}
                  </span>
                                    <h3>{product.name}</h3>                 {" "}
                  <p className="product-description">
                                       {" "}
                    {product.description || "Quality groceries."}               
                     {" "}
                  </p>
                                   {" "}
                  <div className="product-card-bottom">
                                       {" "}
                    <strong>
                                            ₦
                      {Number(product.price).toLocaleString("en-NG")}           
                             {" "}
                    </strong>
                                       {" "}
                    <Link
                      to={`/products/${product.id}`}
                      className="product-view-button"
                    >
                                            View Product                  
                       {" "}
                    </Link>
                                     {" "}
                  </div>
                                 {" "}
                </div>
                             {" "}
              </article>
            ))}
                     {" "}
          </div>
        )}
             {" "}
      </section>
           {" "}
      <section className="cta-section">
               {" "}
        <div>
                    <span>BIG SAMMY GROCERIES</span>         {" "}
          <h2>
            Your everyday groceries,
            <br />            made easier.          {" "}
          </h2>
                   {" "}
          <p>
            Browse our products and start building your shopping cart today.    
                 {" "}
          </p>
                   {" "}
          <Link to="/products" className="primary-button">
                        Start Shopping          {" "}
          </Link>
                 {" "}
        </div>
             {" "}
      </section>
         {" "}
    </div>
  );
};

export default Home;
