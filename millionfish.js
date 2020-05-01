
window.onload = function () {
  window.counter = 0
  window.gs = []
  window.gs[window.counter] = new Guppy('guppy' + window.counter)
  window.gsm = new Guppy('guppym')
  window.gsn = new Guppy('guppyn')
  window.gso = new Guppy('guppyo')
  document.getElementById('fileinput').addEventListener('change', readSingleFile, false)
}

class Term {
  constructor (syntax) {
    if (Array.isArray(syntax)) {
      if (!(syntax[0] === 'blank')) {
        this.op = syntax[0]
        this.c = syntax[1].map(x => new Term(x))
      }
    } else {
      this.c = syntax
    }
    if (this.c === undefined) {
      this.c = []
    }
  }

  toSyntax () {
    if (this.op === undefined) {
      return this.c
    } else {
      return [this.op, this.c.map(x => x.toSyntax())]
    }
  }

  copyFrom (source) {
    const syntax = JSON.parse(JSON.stringify(source.toSyntax())) // https://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-deep-clone-an-object-in-javascript
    const temp = new Term(syntax)
    this.op = temp.op
    this.c = temp.c
  }

  clone () {
    const rv = new Term()
    rv.copyFrom(this)
    return rv
  }
}

const one = new Term(['val', [1]])


const addnew = function () {
  const tag = document.createElement('div')
  window.counter++
  tag.id = 'guppy' + window.counter

  const element = document.getElementById('new')
  element.appendChild(tag)
  window.gs[window.counter] = new Guppy('guppy' + window.counter)
  const temp = window.gs[window.counter - 1].engine.get_content('ast')
  const temp2 = JSON.parse(temp)
  if (temp2[0] !== 'blank') {
    window.gs[window.counter].import_syntax_tree(temp2)
  }
}

const deletelast = function () {
  if (window.counter === 0) { return }
  const element = document.getElementById('guppy' + window.counter)
  element.parentNode.removeChild(element)
  window.gs[window.counter] = undefined
  window.counter--
}

const compare = function (a, b) {
  if (a.op !== b.op) {
    return false
  }
  if (a.op === undefined) {
    return a.c === b.c
  }
  if (a.c.length !== b.c.length) {
    return false
  }
  for (let idx = 0; idx < a.c.length; idx++) {
    if (!compare(a.c[idx], b.c[idx])) {
      return false
    }
  }
  return true
}

const createmult = function (a, b) {
  if (compare(a, one)) {
    return b.clone()
  }
  if (compare(b, one)) {
    return a.clone()
  }
  const rv = new Term()
  rv.op = '*'
  rv.c = [a.clone(), b.clone()]
  return rv
}

const helpermain = function (fun) {
  const selStart = window.gs[window.counter].engine.sel_start
  const selEnd = window.gs[window.counter].engine.sel_end
  const selStatus = window.gs[window.counter].engine.sel_status
  sel_copy(window.gs[window.counter])

  window.gsn.engine.set_content('')
  sel_paste(window.gsn)
  const t = new Term(JSON.parse(window.gsn.engine.get_content('ast')))
  const todo = new Term(JSON.parse(window.gsm.engine.get_content('ast')))
  if (fun(t, todo)) {
    window.gsn.import_syntax_tree(t.toSyntax())
    window.gsn.engine.sel_all()
    sel_copy(window.gsn)
    window.gso.import_text('(a+b)*c')
    for (let idx = 0; idx < 10; idx++) {
      window.gso.engine.left()
    }
    window.gso.engine.right()
    window.gso.engine.sel_right()
    window.gso.engine.sel_right()
    window.gso.engine.sel_right()
    sel_paste(window.gso)
    window.gso.engine.end()
    window.gso.engine.backspace()
    window.gso.engine.backspace()
    window.gso.engine.sel_all();
    sel_copy(window.gso)
    window.gs[window.counter].engine.sel_start = selStart
    window.gs[window.counter].engine.sel_end = selEnd
    window.gs[window.counter].engine.sel_status = selStatus
    sel_paste(window.gs[window.counter])
    window.gs[window.counter].import_syntax_tree(JSON.parse(window.gs[window.counter].engine.get_content('ast')))
  }
}

const ismult = function (term) {
  return term.op === '*' || term.op === 'fraction'
}

const findtimes = function (term, todo) {
  if (compare(term, todo)) {
    term.copyFrom(one)
    return true
  }
  for (let idx = 0; idx < 1 + (term.op === '*'); idx++) {
    if (compare(term.c[idx], todo)) {
      if (term.op === '*') {
        term.copyFrom(term.c[1 - idx])
      } else {
        term.c[idx] = one
      }
      return true
    }
    if (ismult(term.c[idx])) {
      if (findtimes(term.c[idx], todo)) {
        return true
      }
    }
  }
  return false
}

const factorout = function (term, todo) {
  if (!(term.op === '+' || term.op === '-' || term.op === 'neg')) {
    return false
  }
  for (let idx = 0; idx < term.c.length; idx++) {
    if (compare(term.c[idx], todo)) {
      term.c[idx] = one
      continue
    }
    if (ismult(term.c[idx])) {
      if (!findtimes(term.c[idx], todo)) {
        return false
      }
      continue
    }
    if (!factorout(term.c[idx], todo)) { return false }
  }
  return true
}

const expandleftrightin = function (term, multor, goleft) {
  if (term.op === '+') {
    expandleftrightin(term.c[0], multor, goleft)
    expandleftrightin(term.c[1], multor, goleft)
  } else {
    if (goleft === 0) {
      term.copyFrom(createmult(term, multor))
    } else {
      term.copyFrom(createmult(multor, term))
    }
  }
}
const expandleftright = function (term, todo, goleft) {
  if (term.op === '*') {
    expandleftrightin(term.c[goleft], term.c[1 - goleft], goleft)
    term.copyFrom(term.c[goleft])
    return true
  }
  return false
}

const extendfraction = function (term, todo) {
  if (term.op === 'fraction') {
    term.c[0] = createmult(todo, term.c[0])
    term.c[1] = createmult(todo, term.c[1])
    return true
  }
  return false
}

const pullin = function (term, todo) {
  if (term.op === '*' && term.c[1].op === 'fraction') {
    term.op = 'fraction'
    term.c[0] = createmult(term.c[0], term.c[1].c[0])
    term.c[1].copyFrom(term.c[1].c[1])
    return true
  }
  return false
}

const shortfraction = function (term, todo) {
  if (term.op === 'fraction') {
    const rv = findtimes(term.c[0], todo) && findtimes(term.c[1], todo)
    if (compare(term.c[1], one)) {
      term.copyFrom(term.c[0])
    }
    return rv;
  } else {
    return false
  }
}

const download = function (filename, text) { // https://ourcodeworld.com/articles/read/189/how-to-create-a-file-and-generate-a-download-with-javascript-in-the-browser-without-a-server
  const element = document.createElement('a')
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

const downloadHere = function () {
  let text = '['
  text += window.gsm.engine.get_content('ast')
  for (let idx = 0; idx < window.counter + 1; idx++) {
    text += ',' + window.gs[idx].engine.get_content('ast')
  }
  text += ']'
  download('millionfish.txt', text)
}

const readSingleFile = function (evt) { // https://www.htmlgoodies.com/beyond/javascript/read-text-files-using-the-javascript-filereader.html
  const f = evt.target.files[0]

  if (f) {
    const r = new FileReader()
    r.onload = function (e) {
      const contents = e.target.result
      const parsed = JSON.parse(contents)
      while (window.counter > parsed.length - 2) {
        deletelast()
      }
      while (window.counter < parsed.length - 2) {
        addnew()
      }
      window.gsm.import_syntax_tree(parsed[0])
      for (let idx = 0; idx < window.gs.length; idx++) {
        window.gs[idx].import_syntax_tree(parsed[idx + 1])
      }
    }
    r.readAsText(f)
  } else {
    alert('Failed to load file')
  }
}

// eslint-disable-next-line camelcase
const sel_copy = function (gsh) {
  var sel = gsh.engine.sel_get()
  if (!sel) return
  window.myclipboard = []
  for (var i = 0; i < sel.node_list.length; i++) {
    var node = sel.node_list[i].cloneNode(true)
    window.myclipboard.push(node)
  }
  gsh.engine.sel_clear()
}

const sel_paste = function (gsh) {
  gsh.engine.sel_delete()
  gsh.engine.sel_clear()
  if (!window.myclipboard || window.myclipboard.length === 0) return
  gsh.engine.insert_nodes(window.myclipboard, true)
  gsh.engine.checkpoint()
}

const exp1 = function (term, todo) {
  if (term.op !== '*') {
    return false
  }
  const stor = new Term()
  stor.op = 'exponential'
  stor.c[0] = todo.clone()
  stor.c[1] = new Term()
  stor.c[1].op = '+'
  for (let idx = 0; idx < 2; idx++) {
    if (compare(term.c[idx], todo)) {
      stor.c[1].c[idx] = one
      continue
    }
    if (term.c[idx].op === 'exponential') {
      if (compare(term.c[idx].c[0], todo)) {
        stor.c[1].c[idx] = term.c[idx].c[1]
        continue
      }
    }
    return false
  }
  term.copyFrom(stor)
  return true
}

const swap = function (term, todo) {
  if (term.op === '*' || term.op === '+') {
    const temp = term.c[0]
    term.c[0] = term.c[1].clone()
    term.c[1] = temp.clone()
    return true
  }
  return false
}
