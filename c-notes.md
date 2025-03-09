# C notes

## Theory

### The library

- Contains the routines that make the standard C functions work for a specific hardware platform

### The Compiler

- Creates an object code file based on the source code file (object code file names end with the `.o` extension)

### The Linker

- Combines object code file(s) with the C library

### C Preprocessor

- Prepares a source code file for compiling
- Uses preprocessor directives and is not C code

### Defined constants

- Are usually written in all caps

### Header Files vs Libraries

- Header files are used in source code
  - Contain function prototypes, definitions, macros, etc.
  - A missing header file generates a compiler warning
- Libraries are used by the linker
  - Support the power of common C language functions
  - C library functions reside in a library
  - Missing libraries generate linker errors



