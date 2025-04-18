___# C notes

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
- For single characters single quotes: `''` are used

##### String Literals

```c
// \0 null character makes a variable a string, it terminates string
char greetings[4] = { 'H', 'i', '\x21', '\0'};
```

- Character arrays are used as strings
- Contained within double quotes: `""`
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

### Conversion Specifications (Placeholders)

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

### Math

#### Basic operations

##### Postfixed
Postfixed math operations take place after the variable is used, e.g.:
  ```c
  int a;
  a = 10;
  printf("a is %d\n", a++);
  // a is 10
  printf("a is %d\n", a);
  // a is 11
  ```

- Increment
  ```c
  a++;
  ```
- Decrement
  ```c
  b--;
  ```

##### Prefixed
Prefixed math operations take place before the variable is used, e.g.:
  ```c
  int a;
  a = 10;
  printf("a is %d\n", ++a);
  // a is 11
  printf("a is %d\n", a);
  // a is 11
  ```
- Increment
  ```c
  a++;
  ```
- Decrement
  ```c
  b--;
  ```

##### division

- Always specify a float value for division and use the decimal portion (`.0`) when assigng a value

##### `%` modulo operator

- Obtains the modulo of two values

##### Assignment operators

- Basic
```c
a += 5; // Bit shift left
a -= 5; // Bit shift right
a *= 5; // Bitwise AND
a /= 5; // Bitwise exclusive OR
a %= 5; // Bitwise OR
```

- `<<=`
  - Bit shift left

- `>>=`
  - Bit shift right

- `&=`
  - Bitwise AND

- `^=`
  - Bitwise exclusive OR

- `|=`
  - Bitwise OR

#### Order of Precedence

1. Left to right
2. Parentheses first
3. Multiplication, division
4. Addition, subtraction

##### Expressions

- Parentheses (grouping): `()`
- Brackets (elements): `[]`
- Pointer structure member: `->`
- Structure member: `.`

##### Unary Operators
- Affect only one variable

- Not: `!`
  - Expression must be enclosed in parentheses, because it is a unary operator
  ```c
  if ( !(a < 10))
  ```
- One's complement: `~`
  - It changes 1 to 0 and 0 to 1.
- Negative: `-`
  - Sets negative value
- Positive: `+`
  - Sets positive value
- Pointer dereference: `*`
- Address-of: `&`
- Increment: `++`
- Decrement: `--`
- Data size: `sizeof`
  - Used on variables, arrays, allocated memory
  - Returns a `size_t` value (unsigned positive integer, representing the number of bytes of memory the item occupies)
  - `stdio.h` header file must be included in the code
  - Used when allocating memory or dealing with pointers

##### Binary Operators

- Bitwise logical AND: `&`
- Bitwise exclusive OR (XOR): `^`
- Bitwise logical OR: `|`
- Logical AND: `&&`
- Logical OR: `||`

##### Bitwise Operators

- These operators shift the bits in a byte
- `X` is an integer variable to shift right or left by `N` bits
  - `a = x >> n`
  - `a = x << n`
- Zero bits are shifte into the value from left to right
- Bits shifted off the edge are gone
- In C++ these operators are used to *put-to* or *get-from* operator
- At the binary level, shifting bits left one notch doubles the integer value. (1, 2, 4, 8, ...)

- Left shift: `<<`
  - Example of bitwise math (doubling value twice):
  ```c
  int a = 10;

  a <<= 2;

  // Output:
  // 40
  
- Right shift: `>>`
  - Example of bitwise math (division by half) and it is much faster than using the division operator on an integer:
  ```c
      int a = 1000000;

    while (a > 0)
    {
        printf("%d\n", a);
        a >>= 1; // a shifted to the right one position (one notch to the right)
    }
    // Output:
    // 1000000
    // 500000
    // 250000
    // 125000
    // 62500
    // 31250
    // 15625
    // 7812
    // 3906
    // 1953
    // 976
    // 488
    // 244
    // 122
    // 61
    // 30
    // 15
    // 7
    // 3
    // 1
    ```
    The division isn't perfect because binary values lack decimal parts

##### Remaining Operators

- Ternary operator: `?`, `:`
  - Shorthand way for writing an `if-else` statement
  ```c
  int a = 10;
  int b = 14;
  // Statement is false, so c = b
  int c = ( a > b) ? a : b;
  ```
- Assignment operator: `=`
- Separator: `,`

#### Logical operators

##### Logical Operator Considerations

- The value `0` is *FALSE*
- Nonzero values are *TRUE*
- `-1` is *TRUE* in C

### Decisions

#### `if` keyword

The expression must be true or a `non-zero value`; `zero` is considered false in C.

#### `switch-case` structure

- It is a control flow structure that allows you to execute one of many code blocks based on the value of an expression `a`
```c
int a;

printf("Select item 1, 2, or 3: ");
scanf("%d",&a);

switch(a)
{
  case 1:
    puts("This is the first item");
    break;
  case 2:
    puts("This is the second item");
    break;
  case 3:
    puts("You chose the third item");
    break;
  default:
    puts("Invalid choice");
}
```

- Part of the coding challenge program:
  ```c
  switch (input)
  {
    // OR statement for both cases could be done as follows:
    case 'R':
    case 'r':
        printf("move right\n");
        break;
    case 'L':
    case 'l':
        printf("move left\n");
        break;
    default:
        printf("Invalid command\n");
        break;    
  }
  ```


### Loops

#### `do while` loop

- Executes at least once

#### `break`

- It is used to break the loop in some condition

#### `goto` 

- It should be avoided, because of it's unexpected behaviour

#### Nested loops

- `for loops` could be more useful after all, as we can make nested loops with them - it is possible to make them with `while` loops, but they will have more lines of code
- The nested loop can manipulate any data type, but works best on data that's organized in a table or grid.

### Functions

- Use a function when you use the same statements to perform the same process repeatedly
- Use a function to handle a specific task

#### `getchar()`

- Reads input and return integers values
- Program which has implementation of checking occurence of `\n`, which is problematic in that case:
  ```c
  int input;
    int done = FALSE;
    while (!done)
    {
        printf("Enter a command: ");
        input = getchar();
        switch (input)
        {
        case 'R':
        case 'r':
            printf("move right\n");
            break;
        default:
            printf("Invalid command\n");
            break;
        }
        while (( input = getchar() )!= '\n')
        // If the current char is \n, we are not proceeding with this loop
          ;
    }
  ```

#### `putchar()`

- Is a part of the standard C library and is used to write a single character to the standard output
- E.g. use with `if` statement:
  ```c
  int a = 1;

  while(a <= 5)
  {
    if( a == 3)
      putchar('*'); // Single quotes are for character
    printf("%d\n", a); // Double quotes " are for string
    a++;
  }
  // Output:
  // 1
  // 2
  // *3
  // 4
  // 5
  ```