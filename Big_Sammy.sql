INSERT INTO users (
    first_name,
    last_name,
    email,
    phone,
    password
)
VALUES (
    'Brian',
    'Gadafi',
    'brian@example.com',
    '08012345678',
    '$2b$12$ExampleHashedPassword123',
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
);