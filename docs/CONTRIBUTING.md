# Contributing to c0py.me

Thank you for your interest in contributing to c0py.me! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up the development environment** (see [Development Instructions](development/instructions.md))
4. **Create a branch** for your changes

## 📋 Development Workflow

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Making Changes

1. **Follow the code style**
   - Use TypeScript for all new code
   - Follow ESLint configuration
   - Use Prettier for formatting
   - Write meaningful commit messages

2. **Write tests** (if applicable)
   - Unit tests for utilities
   - Integration tests for features
   - Update existing tests as needed

3. **Update documentation**
   - Update relevant docs in `docs/`
   - Add JSDoc comments for complex functions
   - Update README if needed

## 🔍 Code Review Process

1. **Push your changes** to your fork
2. **Create a Pull Request** with:
   - Clear description of changes
   - Reference to related issues
   - Screenshots (for UI changes)
3. **Address review feedback**
4. **Wait for approval** before merging

## 📝 Commit Message Guidelines

Use conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(webrtc): add adaptive chunking for mobile devices
fix(socket): resolve connection timeout issues
docs(readme): update installation instructions
```

## 🧪 Testing

Before submitting:
- Run linting: `pnpm lint`
- Run type checking: `pnpm type-check`
- Test your changes locally
- Ensure no console errors

## 📚 Documentation

When contributing:
- Update relevant documentation in `docs/`
- Add comments for complex logic
- Update API documentation if needed
- Keep examples up to date

## 🐛 Reporting Issues

Use GitHub Issues to report bugs or request features:
- Use clear, descriptive titles
- Provide steps to reproduce
- Include environment details
- Add screenshots if applicable

## 💡 Feature Requests

For feature requests:
- Check [Pending Features](development/to-be-implemented.md) first
- Open an issue with the `enhancement` label
- Describe the use case
- Explain the expected behavior

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Your contributions make c0py.me better for everyone. Thank you for taking the time to contribute!

---

For more information, see:
- [Development Instructions](development/instructions.md)
- [Architecture Overview](architecture/ARCHITECTURE.md)
- [Project README](../README.md)

