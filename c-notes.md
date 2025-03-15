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

### Variables

#### Variable scope

##### `auto`

- Default class
- `auto` keyword is optional
- Private variables local to a function, the values of which are released from memory after the function quits

##### `static`

```c
char *myname(void)
{
  static char me[] = "Dan";

  return(me);
}

int main()
{
  printf("Name: %s\n", myname());

  return(0);
}
```

- Variables local to a specific function that retain their values after the function quits

##### `extern`

```c
int a, b;

void sum(void)
{
  extern int a, b;
  a = 91; b = 7;
  printf("%d + %d = %d\n", a, b, a+b);
}

int main()
{
  extern int a, b; // The same variables
}
```

- Variables that exist outside of any function, the values of which are retained and available to all functions
- Also known as a **global variable**
- There are better ways to share variables between functions
- Avoid using external (global) variables unless they're absolutely necessary

#### Typecasting

```c
int a, b;

a = 100;
b = 7;

// Answer could be a float type so we have to use %f
printf("%d / %d = %f\n", a, b, (float)a/b);
```
- `typecast` directs the compiler to treat the above expression as a real number(float)
- The expression now matches the `%f` placeholder

```c
srand((unsigned)time(NULL));
```
- `unsigned` typecast is used on `time` function to ensure that the value returned is always a positive integer
- It's rare to use typecast, use the proper data type

### Data Types

#### `char`

- Single characters or bytes
- Conversion Character:
  - `%c` - single character
  - `%s` - string
- Escape sequences:
  - `\n` - new line
  - `\t` - tab
  - `\v` - vertical tab
  - `\"` - " character
  - `\'` - ' character
  - `\xn` - hexadecimal **n** value (base 16)
  - `\?` - ? character
  - `\0` - null character

##### String Literals

```c
// \0 null character makes a variable a string, it terminates string
char greetings[4] = { 'H', 'i', '\x21', '\0'};
```

- Character arrays are used as strings
- Contained within double quotes
- Everything between the double quotes is part of the string
- Strings are terminated with the null character, `\0`
- The null character is added automatically to a string literal
- When manipulating strings in your code, use the null character terminator

```c
// Brackets are empty as the compiler sets the string'sbuffer size
// Null character is added automatically, so it need not to be specifed here
char string[] = "I'm a string\n";
```

#### `int`

- Integer or whole-number values
- Conversion Character:
  - `%d, %i` - integer as a decimal
  - `%u` - unsigned integer
- 

#### `float`

- Real numbers
- Single precision
- Accurate to 8 digits
- Conversion Character:
  - `%f` - floating point
- Trailing zero, informs the compiler that the literal value is a float or double number:
  ```c
  double large = 10.0
  ```
- Suffix character:
  ```c
  float z = 10.0F;
  ```
  - There must be `.0` part, so `F` is somehow redundant

#### `double`

- Real numbers
- Double precision
- Accurate to 16 digits
- Conversion Character:
  - `%f` - floating point

##### Number Bases

###### Hexadecimal

```c
int x;
for(x=0x1 ; x<=0x10; x++)
```

- base 16
- Hexadecimal value is prefixed by `0x`

###### Octal

```c
int o;
for(o=01 ; o<= 010; o++)
```

- base 8
- Octal value is prefixed by `0`

#### `void`

- No data rype
- Used when allocating memory
- Used for function definitions
  - Return no value
  - Accept no arguments

### Defined Data Types (`typedefs`)

- The `typedef` keyword defines new data types, format: 
```c
typedef data_type new_definition

// E.g.:
typedef long unsigned time_t

```
- Special data types may differ from system to system
- The `typedef` keeps the data type consistent to maintain and compatible between systems
- These definitions are commonly held in a header file
- Often used with structures to reduce the structure declaration
- Nonstandard data types are created by using a `typedef` statement
- Documentation (the man page) explains how the defined data type should be used



### Data Type Qualifiers

#### `short`

- 

#### `long`

- Suffix character:
  ```c
  long x = 100L;
  ```

#### `long long`

- 

#### `signed`

- Default qualifier
- Stores both positive and negative values

#### `unsigned`

- Only positivie values
- Conversion Characters:
  - `%u` - unsigned integer
- Suffix character:
  ```c
  unsigned y = 17U;
  ```

### Convesrion Specifications (Placeholders)

```c
%[options]n
```

- Prefixed by the `%` character
- Followed by optional characters to set output format, width, justification, etc.
- E.g. limit the floating point value's output to two digits after the decimal place
  ```c
  "%.2f"
  ```
- Conversion character comes last, matching the companion arguments data type
  - Conversion Characters:
    - `%e, %E` - scientific notation
    - `%g, %G` - floating-point or scientific output for large numbers
    - `%x, %X` - hexadecimal (lowercase, uppercase)
    - `%o` - octal
    - `%p` - memory address in hexadecimal
    - `%z` - memory size (of `size_t `value)
    - `%%` - `%` character

### Constants

```c
const int count = 10;
```

### Pre-processor directives

### `#define`

```c
#define MAX 20
```

- Used to use constant in multiple function in a source code file
