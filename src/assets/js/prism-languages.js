(function () {
  "use strict";

  if (typeof Prism === "undefined") return;

  Prism.languages.csharp = {
    comment: [
      {
        pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
        lookbehind: true,
        greedy: true
      },
      {
        pattern: /(^|[^\\:])\/\/.*/,
        lookbehind: true,
        greedy: true
      }
    ],
    string: [
      {
        pattern: /@\$?"(?:""|\\[\s\S]|[^"])*"/,
        greedy: true
      },
      {
        pattern: /\$@?"(?:\\.|{{|}}|[^"\\])*"/,
        greedy: true
      },
      {
        pattern: /"(?:\\.|[^"\\\r\n])*"/,
        greedy: true
      }
    ],
    char: {
      pattern: /'(?:\\.|[^'\\\r\n])'/,
      greedy: true
    },
    "class-name": [
      {
        pattern: /\b(?:class|interface|struct|record|enum|new|typeof|default|sizeof|is|as|where)\s+[A-Za-z_]\w*/,
        inside: {
          keyword: /^(?:class|interface|struct|record|enum|new|typeof|default|sizeof|is|as|where)/,
          punctuation: /\s+/,
          "class-name": /[A-Za-z_]\w*$/
        }
      },
      {
        pattern: /\b[A-Z]\w*(?=\s*<)/,
        alias: "type"
      }
    ],
    keyword: /\b(?:abstract|add|alias|and|as|ascending|async|await|base|bool|break|by|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|descending|do|double|dynamic|else|enum|equals|event|explicit|extern|false|file|finally|fixed|float|for|foreach|from|get|global|goto|group|if|implicit|in|init|int|interface|internal|into|is|join|let|lock|long|managed|namespace|new|not|null|object|on|operator|or|orderby|out|override|params|partial|private|protected|public|readonly|record|ref|required|return|sbyte|scoped|sealed|select|set|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unmanaged|unsafe|ushort|using|value|var|virtual|void|volatile|when|where|while|with|yield)\b/,
    boolean: /\b(?:true|false)\b/,
    number: /\b(?:0x[\da-f](?:_?[\da-f])*|0b[01](?:_?[01])*|\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:e[+-]?\d(?:_?\d)*)?)(?:[dflmu]|ul|lu)?\b/i,
    function: /\b[A-Za-z_]\w*(?=\s*\()/,
    namespace: /\b(?:System|Microsoft)(?:\.[A-Za-z_]\w*)*\b/,
    operator: />>=?|<<=?|=>|\?\?=?|\?\.|::|\+\+|--|&&|\|\||[+\-*\/%&|^!=<>]=?|[?:~]/,
    punctuation: /[{}[\];(),.]/
  };

  Prism.languages.cs = Prism.languages.csharp;

  Prism.languages.asm = {
    comment: {
      pattern: /(?:#|;|\/\/).*/,
      greedy: true
    },
    string: {
      pattern: /"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'/,
      greedy: true
    },
    label: {
      pattern: /^[ \t]*[A-Za-z_.$][\w.$]*:/m,
      inside: {
        punctuation: /:$/,
        symbol: /[A-Za-z_.$][\w.$]*/
      }
    },
    directive: {
      pattern: /(^|[\s,])\.[A-Za-z][\w.]*/m,
      lookbehind: true,
      alias: "keyword"
    },
    mnemonic: {
      pattern: /(^|^\s*|\s)(?:add|addi|sub|lui|auipc|jal|jalr|beq|bne|blt|bge|bltu|bgeu|lb|lh|lw|lbu|lhu|sb|sh|sw|sll|slli|slt|slti|sltiu|sltu|xor|xori|srl|srli|sra|srai|or|ori|and|andi|fence|ecall|ebreak|mul|mulh|mulhsu|mulhu|div|divu|rem|remu|li|la|mv|nop|j|jr|ret|call|tail)\b/im,
      lookbehind: true,
      alias: "keyword"
    },
    register: {
      pattern: /\b(?:x(?:[0-9]|[12][0-9]|3[01])|zero|ra|sp|gp|tp|t[0-6]|s(?:[0-9]|1[01])|fp|a[0-7])\b/i,
      alias: "variable"
    },
    number: /\b(?:0x[\da-f]+|0b[01]+|-?\d+)\b/i,
    operator: /[-+]/,
    punctuation: /[()[\],:]/
  };

  Prism.languages.assembly = Prism.languages.asm;

  Prism.languages.css = {
    comment: {
      pattern: /\/\*[\s\S]*?\*\//,
      greedy: true
    },
    atrule: {
      pattern: /@[\w-]+(?:\s+[^;{]+)?(?=\s*[;{])/,
      inside: {
        rule: /^@[\w-]+/,
        keyword: /\b(?:all|and|not|only|or)\b/,
        punctuation: /[:(),]/
      }
    },
    url: {
      pattern: /\burl\((?:"[^"]*"|'[^']*'|[^)]*)\)/i,
      greedy: true,
      inside: {
        function: /^url/i,
        punctuation: /[()]/
      }
    },
    selector: {
      pattern: /[^{}\s][^{}]*(?=\s*\{)/,
      inside: {
        class: /\.[A-Za-z_][\w-]*/,
        id: /#[A-Za-z_][\w-]*/,
        pseudo: /::?[A-Za-z-]+(?:\([^)]*\))?/,
        attribute: /\[[^\]]+\]/,
        operator: /[>+~|^$*]?=/,
        punctuation: /[.,:[\]()#]/
      }
    },
    property: {
      pattern: /(^|[{\s;])(?:--[\w-]+|[A-Za-z-]+)(?=\s*:)/,
      lookbehind: true
    },
    string: {
      pattern: /"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'/,
      greedy: true
    },
    important: /!important\b/i,
    function: /[-a-z0-9]+(?=\()/i,
    number: /(?:\b|\B-?)(?:\d+(?:\.\d+)?|\.\d+)(?:%|[a-z]+)?\b/i,
    boolean: /\b(?:true|false)\b/,
    operator: /[+\-*\/%=<>]/,
    punctuation: /[{}();:,]/
  };

  Prism.languages.scss = Prism.languages.css;
  Prism.languages.sass = Prism.languages.css;

  if (Prism.languages.javascript) {
    Prism.languages.typescript = Prism.languages.extend("javascript", {
      keyword: /\b(?:abstract|any|as|asserts|bigint|boolean|break|case|catch|class|const|constructor|continue|debugger|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|infer|instanceof|interface|is|keyof|let|module|namespace|never|new|null|number|object|of|override|package|private|protected|public|readonly|require|return|set|static|string|super|switch|symbol|this|throw|true|try|type|typeof|undefined|unique|unknown|var|void|while|with|yield)\b/
    });
  }

  Prism.languages.python = {
    comment: { pattern: /#.*/, greedy: true },
    string: [
      { pattern: /"(?:\\.|[^"\\\r\n])*"/, greedy: true },
      { pattern: /'(?:\\.|[^'\\\r\n])*'/, greedy: true }
    ],
    keyword: /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|exec|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b/,
    builtin: /\b(?:abs|all|any|bin|bool|bytes|callable|chr|dict|dir|divmod|enumerate|eval|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|str|sum|super|tuple|type|vars|zip)\b/,
    number: /\b(?:0x[\da-f]+|0b[01]+|0o[0-7]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/i,
    function: /\b[A-Za-z_]\w*(?=\s*\()/,
    operator: /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|[<>]=?|&|\||\^|~/,
    punctuation: /[{}[\];(),.:]/
  };

  Prism.languages.bash = {
    comment: { pattern: /(^|[^\\])#.*/, lookbehind: true, greedy: true },
    string: [
      { pattern: /"(?:\\[\s\S]|\$\([^)]*\)|\$\{[^}]*\}|[^"\\])*"/, greedy: true },
      { pattern: /'(?:[^']*)'/, greedy: true }
    ],
    keyword: /\b(?:if|then|else|elif|fi|for|while|in|do|done|case|esac|function|select|until|time|coproc)\b/,
    builtin: /\b(?:alias|bg|bind|break|builtin|cd|command|compgen|complete|continue|declare|dirs|disown|echo|enable|eval|exec|exit|export|fc|fg|getopts|hash|help|history|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readonly|return|set|shift|shopt|source|suspend|test|times|trap|type|typeset|ulimit|umask|unalias|unset|wait)\b/,
    variable: /\$(?:\w+|\{[^}]+\})/,
    number: /\b\d+\b/,
    operator: /&&|\|\||;;|[|&;<>]=?/,
    punctuation: /[()[\]{}]/
  };
})();
