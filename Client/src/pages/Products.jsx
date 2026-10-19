import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { getCategories } from '../services/categoryService';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);

    const [loading, setLoading] = useState(true);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [error, setError] = useState('');

    const [filters, setFilters] = useState({
        search: '',
        category: '',
        minPrice: '',
        maxPrice: '',
    });

    const fetchProducts = async () => {
        setLoading(true);
        setError('');

        try {
            const params = {};

            if (filters.search.trim()) {
                params.search = filters.search.trim();
            }

            if (filters.category) {
                params.category = filters.category;
            }

            if (filters.minPrice !== '') {
                params.minPrice = filters.minPrice;
            }

            if (filters.maxPrice !== '') {
                params.maxPrice = filters.maxPrice;
            }

            const response = await api.get('/products', {
                params,
            });

            setProducts(response.data.data);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                'Unable to load products. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const result = await getCategories();

            const activeCategories = (result.data || []).filter(
                (category) => category.is_active
            );

            setCategories(activeCategories);
        } catch (error) {
            console.error('Unable to load categories:', error);
        } finally {
            setCategoriesLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const handleChange = (event) => {
        const { name, value } = event.target;

        setFilters((previousFilters) => ({
            ...previousFilters,
            [name]: value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        fetchProducts();
    };

    const handleClearFilters = () => {
        setFilters({
            search: '',
            category: '',
            minPrice: '',
            maxPrice: '',
        });

        setTimeout(() => {
            fetchProducts();
        }, 0);
    };

    return (
        <div className="products-page">

            <section className="products-header">
                <span>BIG SAMMY GROCERIES</span>

                <h1>Shop our products</h1>

                <p>
                    Browse fresh groceries and everyday essentials.
                </p>
            </section>

            <section className="products-content">

                <form
                    className="product-filters"
                    onSubmit={handleSubmit}
                >
                    <input
                        type="text"
                        name="search"
                        value={filters.search}
                        onChange={handleChange}
                        placeholder="Search products..."
                    />

                    <select
                        name="category"
                        value={filters.category}
                        onChange={handleChange}
                        disabled={categoriesLoading}
                    >
                        <option value="">
                            {categoriesLoading
                                ? 'Loading categories...'
                                : 'All categories'}
                        </option>

                        {categories.map((category) => (
                            <option
                                key={category.id}
                                value={category.slug}
                            >
                                {category.name}
                            </option>
                        ))}
                    </select>

                    <input
                        type="number"
                        name="minPrice"
                        value={filters.minPrice}
                        onChange={handleChange}
                        placeholder="Min price"
                        min="0"
                    />

                    <input
                        type="number"
                        name="maxPrice"
                        value={filters.maxPrice}
                        onChange={handleChange}
                        placeholder="Max price"
                        min="0"
                    />

                    <div className="product-filter-actions">
                        <button type="submit">
                            Search
                        </button>

                        <button
                            type="button"
                            onClick={handleClearFilters}
                        >
                            Clear
                        </button>
                    </div>
                </form>

                {loading && (
                    <div className="products-message">
                        <p>Loading products...</p>
                    </div>
                )}

                {!loading && error && (
                    <div className="products-message">
                        <p>{error}</p>
                    </div>
                )}

                {!loading && !error && products.length === 0 && (
                    <div className="products-message">
                        <p>No products found.</p>
                    </div>
                )}

                {!loading && !error && products.length > 0 && (
                    <div className="product-grid">
                        {products.map((product) => (
                            <article
                                className="product-card"
                                key={product.id}
                            >
                                <div className="product-card-image">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                        />
                                    ) : (
                                        <span>🛒</span>
                                    )}
                                </div>

                                <div className="product-card-content">
                                    <span className="product-category">
                                        {product.category_name}
                                    </span>

                                    <h2>{product.name}</h2>

                                    <p className="product-description">
                                        {product.description ||
                                            'Quality grocery product.'}
                                    </p>

                                    <div className="product-card-bottom">
                                        <strong>
                                            ₦
                                            {Number(
                                                product.price
                                            ).toLocaleString()}
                                        </strong>

                                        <Link
                                            to={`/products/${product.id}`}
                                            className="product-view-button"
                                        >
                                            View Product
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}

            </section>
        </div>
    );
};

export default Products;