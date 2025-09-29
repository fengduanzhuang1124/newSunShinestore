Student's Name: skylar  
Supervisor's Name: Shaoqun Wu

## Week 1 : From 28-07-2025 to 01-08-2025

| Date | Activity | Thoughts/Opinions/Reflections | Supervisor's Comments |
| --- | --- | --- | --- |
| 28-07-2025 | Project initialization: Determined tech stack (Node.js + Express + MySQL + uni-app + Vue.js); Created project directory structure; Familiarized with front-end/back-end separated architecture development workflow | Tech stack selection considered cross-platform development needs, uni-app supports both WeChat Mini Program and H5; Front-end/back-end separation improved development efficiency and system maintainability |  |
| 29-07-2025 | Database design and table creation: Designed users, products, orders, order_items, cart table structures; Learned MySQL foreign key constraints and ENUM type usage; Considered WeChat login field extensions | Database design must consider business scalability, foreign key constraints ensure data integrity, ENUM types improve data standardization |  |
| 30-07-2025 | Backend RESTful API route design: Created controllers, routes, middleware directory structure; Designed user, product, order related API interfaces | RESTful design principles make APIs more standardized, facilitating frontend calls and future maintenance |  |
| 31-07-2025 | JWT authentication system implementation: Integrated jsonwebtoken library, implemented JWT token generation and verification; Learned bcryptjs password encryption technology | JWT stateless authentication suits distributed systems, bcryptjs encryption ensures password security |  |
| 01-08-2025 | Role-based access control middleware: Implemented auth.js middleware, distinguished admin and customer role permissions; Protected APIs requiring authentication | Role permission control is crucial for system security, middleware pattern facilitates unified management |  |

## Week 2 : From 04-08-2025 to 08-08-2025

| Date | Activity | Thoughts/Opinions/Reflections | Supervisor's Comments |
| --- | --- | --- | --- |
| 04-08-2025 | User registration and login functionality: Implemented user registration API (encrypted password storage), login API (JWT token return); Wrote user controller logic | User authentication is fundamental system functionality, password encryption and token mechanism ensure security |  |
| 05-08-2025 | WeChat Mini Program login integration: Initially integrated WeChat login process, learned third-party API debugging and integration methods; Wrote database initialization scripts | Third-party API integration requires careful error and exception handling, debugging process is valuable |  |
| 06-08-2025 | uni-app framework learning: Learned uni-app cross-platform development, mastered Vue.js component-based development patterns; Created frontend project structure | uni-app's one-code-multi-platform feature is excellent, Vue.js component-based development improves code reusability |  |
| 07-08-2025 | Frontend page routing design: Designed pages.json page routing structure, configured tabBar navigation; Created basic page framework | Page routing design should align with user habits, tabBar navigation enhances user experience |  |
| 08-08-2025 | Utility class encapsulation development: Wrote request.js for unified API request handling, implemented router.js navigation management utility class | Utility class encapsulation significantly improves code reusability and maintainability, unified request handling facilitates error management |  |

---

### Key Achievements

**Technical Architecture Setup Complete**
- Backend: Node.js + Express + MySQL, MVC architecture
- Frontend: uni-app + Vue.js, supporting WeChat Mini Program cross-platform development
- Database: Complete e-commerce business table structure design (foreign key constraints, ENUM types)
- Authentication: JWT + bcryptjs security authentication system, role-based access control

**Core Functional Modules**
- User management system (registration/login/authentication/role permissions)
- Product management system (CRUD/pagination/categories/status management)
- Order management system (status flow/shopping cart/order details)
- Frontend page framework (multi-page/routing/navigation/tabBar)

**Development Tools and Integration**
- Database initialization script (initDatabase.js)
- API request encapsulation tool (request.js)
- Routing management tool (router.js)
- WeChat Mini Program development environment configuration
- Frontend-backend integration testing and CORS issue resolution
- WeChat domain verification configuration

**Learning Outcomes**
- Mastered front-end/back-end separated architecture development workflow
- Familiar with MySQL database design, foreign key constraints and ENUM type usage
- Practiced JWT authentication and bcryptjs password encryption technology
- Learned uni-app cross-platform development and Vue.js component-based development
- Resolved CORS cross-origin and WeChat domain verification integration issues
- Understood MVC architecture refactoring's improvement to code organization

### Export to PDF (Any Method)

1) VS Code Extension (Recommended)
- Install extension: Markdown PDF  
- Right-click this file → "Markdown PDF: Export (pdf)"

2) Command Line (Pandoc)
```
pandoc weekly-report-week1-2-english.md -o weekly-report-week1-2-english.pdf
```

3) Browser Print to PDF
- Preview this file in VS Code (Ctrl+Shift+V) → Ctrl+P → Print to PDF
