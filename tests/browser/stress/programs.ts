/**
 * Programs for the sandbox stress run (`sandbox-stress.spec.ts`): each
 * exercises a part of Python the sandbox has to run, step through, and draw.
 * `names` are the names memory should end with; `inputs` answer `input()`.
 */
export type StressProgram = { id: string; source: string; names?: string[]; inputs?: string[]; ends?: string }

export const PROGRAMS: StressProgram[] = [
  {
    id: 'aliasing',
    source: 'a = [1, 2, 3]\nb = a\nc = a[:]\nb.append(4)\nc.append(5)\nprint(a, b, c, a is b, a is c)\n',
    names: ['a', 'b', 'c'],
  },
  {
    id: 'nested',
    source:
      'grid = [[0] * 3 for _ in range(3)]\ngrid[1][1] = 5\nbag = {"gems": ["ruby", "jade"], "coins": 12, "map": {"x": 3, "y": 4}}\nbag["gems"].append("opal")\nrow = grid[1]\nprint(grid, bag)\n',
    names: ['bag', 'grid', 'row'],
  },
  {
    id: 'cycle',
    source: 'a = []\na.append(a)\nd = {}\nd["self"] = d\nprint(a, d)\n',
    names: ['a', 'd'],
  },
  {
    id: 'recursion',
    source: 'def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)\n\nresult = fact(6)\nprint(result)\n',
    names: ['fact', 'result'],
  },
  {
    id: 'closures',
    source: 'def counter():\n    count = 0\n    def bump():\n        nonlocal count\n        count += 1\n        return count\n    return bump\n\nc = counter()\nc()\nc()\nprint(c())\n',
    names: ['c', 'counter'],
  },
  {
    id: 'classes',
    source:
      'class Robot:\n    def __init__(self, name, power):\n        self.name = name\n        self.power = power\n        self.parts = []\n    def add(self, part):\n        self.parts.append(part)\n\nr = Robot("Sprocket", 9)\nr.add("wheel")\nr.add("lamp")\ntwin = r\nother = Robot("Bolt", 3)\nprint(r.name, r.parts, other.name)\n',
    names: ['Robot', 'other', 'r', 'twin'],
  },
  {
    id: 'scalars',
    source:
      'n = None\nt = True\nf = -3.75\nbig = 2 ** 100\nneg = -42\nz = 0\nc = 3 + 4j\ns = ""\ntup = (1, "two", 3.0)\nst = {3, 1, 2}\nfs = frozenset([1])\nby = b"bytes"\nprint(n, t, f, big, neg, z, c, repr(s), tup, sorted(st), by)\n',
    names: ['big', 'by', 'c', 'f', 'fs', 'n', 'neg', 's', 'st', 't', 'tup', 'z'],
  },
  {
    id: 'unicode',
    source: 'emoji = "🤖⚙️🔋"\naccents = "naïve café"\ncjk = "机器人"\nrtl = "روبوت"\nmixed = [emoji, cjk]\nprint(emoji, accents, cjk, rtl, len(emoji))\n',
    names: ['accents', 'cjk', 'emoji', 'mixed', 'rtl'],
  },
  {
    id: 'long-strings',
    source: 'long = "x" * 240\nwords = "the quick brown fox jumps over the lazy dog " * 6\nlines = "first\\nsecond\\tthird"\nprint(len(long), len(words))\n',
    names: ['lines', 'long', 'words'],
  },
  {
    id: 'wide-list',
    source: 'nums = list(range(60))\nwords = ["w" + str(i) for i in range(25)]\nprint(sum(nums), len(words))\n',
    names: ['nums', 'words'],
  },
  {
    id: 'many-names',
    source: Array.from({ length: 40 }, (_, i) => `v${i} = ${i * 3}`).join('\n') + '\nprint(v39)\n',
    names: Array.from({ length: 40 }, (_, i) => `v${i}`).sort(),
  },
  {
    id: 'mutation-loop',
    source: 'scores = {}\nfor name in ["ada", "bo", "cy", "di"]:\n    scores[name] = len(name) * 10\n    scores[name] += 1\nbest = max(scores, key=scores.get)\nprint(scores, best)\n',
    names: ['best', 'name', 'scores'],
  },
  {
    id: 'generators',
    source: 'squares = (n * n for n in range(5))\nfirst = next(squares)\nrest = list(squares)\nevens = [n for n in range(10) if n % 2 == 0]\nprint(first, rest, evens)\n',
    names: ['evens', 'first', 'rest', 'squares'],
  },
  {
    id: 'caught',
    source: 'try:\n    x = 1 / 0\nexcept ZeroDivisionError as e:\n    msg = str(e)\nfinally:\n    done = True\nprint(msg, done)\n',
    names: ['done', 'msg'],
  },
  {
    id: 'crash',
    source: 'items = [1, 2]\nprint("before")\nvalue = items[5]\nprint("never")\n',
    names: ['items'],
    ends: 'program crashed',
  },
  {
    id: 'endless',
    source: 'n = 0\nwhile True:\n    n = n + 1\n',
    names: ['n'],
    ends: 'ran out of steps',
  },
  {
    id: 'input-flood',
    source: 'name = input("Name? ")\nage = int(input("Age? "))\nfor i in range(30):\n    print(f"{i:02d} {name} is {age + i}")\n',
    names: ['age', 'i', 'name'],
    inputs: ['Ann', '7'],
  },
  {
    id: 'shadowing',
    source: 'x = "global"\ndef f(x):\n    y = x * 2\n    def g():\n        return x + y\n    return g()\nresult = f("ab")\nprint(x, result)\n',
    names: ['f', 'result', 'x'],
  },
  {
    id: 'quotes',
    source: 's1 = "it\'s"\ns2 = \'say "hi"\'\ns3 = "both \' and \\""\npath = "C:\\\\new\\\\table"\nprint(s1, s2, s3, path)\n',
    names: ['path', 's1', 's2', 's3'],
  },
  {
    id: 'linked-list',
    source:
      'class Node:\n    def __init__(self, value, next=None):\n        self.value = value\n        self.next = next\n\nhead = None\nfor v in [3, 2, 1]:\n    head = Node(v, head)\nwalk = head\ntotal = 0\nwhile walk:\n    total += walk.value\n    walk = walk.next\nprint(total)\n',
    names: ['Node', 'head', 'total', 'v', 'walk'],
  },
  {
    id: 'tree',
    source:
      'class T:\n    def __init__(self, v, l=None, r=None):\n        self.v = v\n        self.left = l\n        self.right = r\n\nroot = T(4, T(2, T(1), T(3)), T(6, T(5), T(7)))\ndef total(t):\n    return 0 if t is None else t.v + total(t.left) + total(t.right)\nprint(total(root))\n',
    names: ['T', 'root', 'total'],
  },
  {
    id: 'deep-nesting',
    source: 'deep = [1, [2, [3, [4, [5, [6]]]]]]\ninner = deep[1][1][1]\ninner.append("end")\nprint(deep)\n',
    names: ['deep', 'inner'],
  },
  {
    id: 'wide-dict',
    source: 'stock = {f"item{i:02d}": i * 7 for i in range(30)}\nstock["item05"] = -1\nprint(len(stock), stock["item05"])\n',
    names: ['stock'],
  },
]
