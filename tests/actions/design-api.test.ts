/**
 * Unit tests for DesignAPI action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesignAPI, DesignNodeType } from '../../src/actions/design-api';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn().mockImplementation((...args) => args.join('/')),
}));

// Mock LLM provider
const mockLLM = {
  chat: vi.fn(),
  getName: () => 'MockLLM',
  getModel: () => 'test-model',
  generate: vi.fn(),
};

// Mock API design response for new design
const mockNewAPIDesign = `
# API Design

## Implementation approach
We will use Express.js for the backend API, MongoDB for the database, and JWT for authentication.

## File list
- app.js
- routes/users.js
- models/user.js
- controllers/userController.js
- middleware/auth.js
- config/db.js

## Data structures and interfaces
\`\`\`mermaid
classDiagram
    class User {
        +String id
        +String username
        +String email
        +String password
        +Date createdAt
        +Boolean isActive
        +create(userData)
        +findById(id)
        +update(id, userData)
        +delete(id)
    }

    class Auth {
        +generateToken(userId)
        +verifyToken(token)
        +hashPassword(password)
        +comparePassword(password, hash)
    }

    class UserController {
        +createUser(req, res)
        +getUser(req, res)
        +updateUser(req, res)
        +deleteUser(req, res)
    }

    UserController --> User : uses
    UserController --> Auth : uses
\`\`\`

## Program call flow
\`\`\`mermaid
sequenceDiagram
    participant Client
    participant UserController
    participant User
    participant Auth
    participant Database

    Client->>UserController: POST /users (Create User)
    UserController->>Auth: hashPassword(password)
    Auth-->>UserController: hashedPassword
    UserController->>User: create(userData)
    User->>Database: Save user data
    Database-->>User: User created
    User-->>UserController: User object
    UserController-->>Client: User created response

    Client->>UserController: POST /login
    UserController->>User: findByEmail(email)
    User->>Database: Query user
    Database-->>User: User data
    User-->>UserController: User object
    UserController->>Auth: comparePassword(password, hash)
    Auth-->>UserController: passwordMatch
    UserController->>Auth: generateToken(userId)
    Auth-->>UserController: token
    UserController-->>Client: Auth token
\`\`\`

## Anything UNCLEAR
The requirements are clear. We will implement a RESTful API for user management with authentication using JWT tokens.
`;

// Mock API design response for refinement
const mockRefinedAPIDesign = `
# Refined API Design

## Refined Implementation Approach
We will enhance our Express.js backend with Redis for caching, implement rate limiting, and add Swagger for API documentation.

## Refined File list
- app.js
- routes/users.js
- routes/products.js
- models/user.js
- models/product.js
- controllers/userController.js
- controllers/productController.js
- middleware/auth.js
- middleware/rateLimit.js
- config/db.js
- config/redis.js
- utils/swagger.js

## Refined Data structures and interfaces
\`\`\`mermaid
classDiagram
    class User {
        +String id
        +String username
        +String email
        +String password
        +Date createdAt
        +Boolean isActive
        +create(userData)
        +findById(id)
        +update(id, userData)
        +delete(id)
    }

    class Product {
        +String id
        +String name
        +String description
        +Number price
        +String category
        +Boolean inStock
        +create(productData)
        +findById(id)
        +findByCat(category)
        +update(id, productData)
        +delete(id)
    }

    class Auth {
        +generateToken(userId)
        +verifyToken(token)
        +hashPassword(password)
        +comparePassword(password, hash)
    }

    class UserController {
        +createUser(req, res)
        +getUser(req, res)
        +updateUser(req, res)
        +deleteUser(req, res)
    }

    class ProductController {
        +createProduct(req, res)
        +getProduct(req, res)
        +getProductsByCat(req, res)
        +updateProduct(req, res)
        +deleteProduct(req, res)
    }

    UserController --> User : uses
    UserController --> Auth : uses
    ProductController --> Product : uses
\`\`\`

## Refined Program call flow
\`\`\`mermaid
sequenceDiagram
    participant Client
    participant RateLimit
    participant Auth
    participant ProductController
    participant Product
    participant Redis
    participant Database

    Client->>RateLimit: GET /products/:id
    RateLimit->>Auth: verifyToken(token)
    Auth-->>RateLimit: validToken
    RateLimit->>ProductController: getProduct(req, res)
    ProductController->>Redis: get(productId)
    
    alt Product in cache
        Redis-->>ProductController: cachedProduct
    else Product not in cache
        Redis-->>ProductController: null
        ProductController->>Product: findById(id)
        Product->>Database: Query product
        Database-->>Product: Product data
        Product-->>ProductController: Product object
        ProductController->>Redis: set(productId, product)
    end
    
    ProductController-->>Client: Product data response
\`\`\`

## Anything UNCLEAR
All requirements are clear now. We have enhanced the API with product management features, caching, and rate limiting.
`;

describe('DesignAPI', () => {
  let designAPI: DesignAPI;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Create DesignAPI instance with mock LLM
    designAPI = new DesignAPI({
      name: 'DesignAPI',
      llm: mockLLM,
    });
    
    // Mock the ask method
    (designAPI as any).ask = vi.fn();
  });
  
  it('should create a DesignAPI instance', () => {
    expect(designAPI).toBeInstanceOf(DesignAPI);
  });
  
  it('should fail when no requirements are provided', async () => {
    // Execute the action without providing requirements
    const result = await designAPI.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('No requirements provided');
  });
  
  it('should fail when no LLM provider is set', async () => {
    // Create DesignAPI instance without LLM
    const designAPINoLLM = new DesignAPI({
      name: 'DesignAPI',
      llm: null as any,
      args: {
        requirements: 'Create a user management API'
      }
    });
    
    // Execute the action
    const result = await designAPINoLLM.run();
    
    // Verify that the action fails with appropriate message
    expect(result.status).toBe('failed');
    expect(result.content).toContain('LLM provider is required');
  });
  
  it('should create a new API design', async () => {
    // Mock the ask method to return the mock API design
    (designAPI as any).ask = vi.fn().mockResolvedValue(mockNewAPIDesign);
    
    // Set args for the action
    (designAPI as any).context.args = {
      requirements: 'Create a RESTful API for user management with authentication.'
    };
    
    // Execute the action
    const result = await designAPI.run();
    
    // Verify the API design result
    expect(result.status).toBe('completed');
    expect(result.content).toBe(mockNewAPIDesign);
    
    // Verify the prompt used
    expect((designAPI as any).ask).toHaveBeenCalledWith(expect.stringContaining('Create a comprehensive API design'));
    expect((designAPI as any).ask).toHaveBeenCalledWith(expect.stringContaining('Create a RESTful API for user management with authentication'));
  });
  
  it('should refine an existing API design', async () => {
    // Mock the ask method to return the refined API design
    (designAPI as any).ask = vi.fn().mockResolvedValue(mockRefinedAPIDesign);
    
    // Set args for the action
    (designAPI as any).context.args = {
      requirements: 'Add product management features, implement caching and rate limiting.',
      existing_design: mockNewAPIDesign
    };
    
    // Execute the action
    const result = await designAPI.run();
    
    // Verify the refined API design result
    expect(result.status).toBe('completed');
    expect(result.content).toBe(mockRefinedAPIDesign);
    
    // Verify the prompt used
    expect((designAPI as any).ask).toHaveBeenCalledWith(expect.stringContaining('refine the existing API design'));
    expect((designAPI as any).ask).toHaveBeenCalledWith(expect.stringContaining('Add product management features'));
    expect((designAPI as any).ask).toHaveBeenCalledWith(expect.stringContaining('LEGACY CONTENT'));
  });
  
  it('should attempt to save design diagrams', async () => {
    // Mock the ask method to return the mock API design
    (designAPI as any).ask = vi.fn().mockResolvedValue(mockNewAPIDesign);
    
    // Set args for the action
    (designAPI as any).context.args = {
      requirements: 'Create a RESTful API for user management with authentication.',
      workdir: './test-output'
    };
    
    // Execute the action
    await designAPI.run();
    
    // Verify that directories were created
    expect(fs.mkdir).toHaveBeenCalledWith(
      'test-output/designs/class_diagrams',
      { recursive: true }
    );
    expect(fs.mkdir).toHaveBeenCalledWith(
      'test-output/designs/sequence_diagrams',
      { recursive: true }
    );
    
    // Verify that files were written
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('class_diagrams/class_diagram_'),
      expect.stringContaining('classDiagram')
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('sequence_diagrams/sequence_diagram_'),
      expect.stringContaining('sequenceDiagram')
    );
  });
  
  it('should handle errors when saving diagrams', async () => {
    // Mock the ask method to return the mock API design
    (designAPI as any).ask = vi.fn().mockResolvedValue(mockNewAPIDesign);
    
    // Make fs.mkdir throw an error
    const mkdirMock = fs.mkdir as unknown as { mockRejectedValueOnce: (error: Error) => void };
    mkdirMock.mockRejectedValueOnce(new Error('Directory creation failed'));
    
    // Set args for the action
    (designAPI as any).context.args = {
      requirements: 'Create a RESTful API for user management with authentication.',
      workdir: './test-output'
    };
    
    // Execute the action
    const result = await designAPI.run();
    
    // Verify that the action still completes despite the error
    expect(result.status).toBe('completed');
    expect(result.content).toBe(mockNewAPIDesign);
  });
}); 