import { useEffect, useState } from 'react';
import api from '../services/api';

const AdminProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        const loadProducts = async () => {
            try {
                const response = await api.get('/products');
                setProducts(response.data.data || []);
            } catch (err) {
                setError('Unable to load products.');
            } finally {
                setLoading(false);
            }
        };

        loadProducts();
    }, []);

    const toggleFeatured = async (product) => {
        const token = localStorage.getItem('token');

        if (!token) {
            setError('Please log in before managing featured products.');
            return;
        }

        const isFeatured = !product.is_featured;

        setSavingId(product.id);
        setError('');
        setSuccess('');

        try {
            const response = await api.patch(
                `/admin/products/${product.id}`,
                { isFeatured },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const updatedProduct = response.data.data;

            setProducts((previous) =>
                previous.map((item) =>
                    item.id === product.id
                        ? {
                              ...item,
                              is_featured:
                                  updatedProduct.is_featured ?? isFeatured,
                          }
                        : item
                )
            );

            setSuccess(
                `${product.name} ${
                    isFeatured ? 'added to' : 'removed from'
                } featured products.`
            );
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    'Unable to update featured status. Check your permissions.'
            );
        } finally {
            setSavingId(null);
        }
    };

    return (
        <main style={{ maxWidth: 1100, margin: '40px auto', padding: 24 }}>
            <h1>Manage Featured Products</h1>
            <p>Select the products displayed on your homepage.</p>

            {error && <p role="alert">{error}</p>}
            {success && <p role="status">{success}</p>}

            {loading ? (
                <p>Loading products...</p>
            ) : products.length === 0 ? (
                <p>No available products found.</p>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {products.map((product) => (
                        <article
                            key={product.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 16,
                                padding: 18,
                                border: '1px solid #ddd',
                                borderRadius: 12,
                                flexWrap: 'wrap',
                            }}
                        >
                            <div>
                                <h3 style={{ margin: '0 0 6px' }}>
                                    {product.name}
                                </h3>

                                <p style={{ margin: 0 }}>
                                    ₦
                                    {Number(product.price).toLocaleString(
                                        'en-NG'
                                    )}
                                </p>

                                <small>
                                    {product.is_featured
                                        ? 'Currently featured'
                                        : 'Not featured'}
                                </small>
                            </div>

                            <button
                                type="button"
                                disabled={savingId !== null}
                                onClick={() => toggleFeatured(product)}
                            >
                                {savingId === product.id
                                    ? 'Saving...'
                                    : product.is_featured
                                      ? 'Remove from Featured'
                                      : 'Make Featured'}
                            </button>
                        </article>
                    ))}
                </div>
            )}
        </main>
    );
};

export default AdminProducts;