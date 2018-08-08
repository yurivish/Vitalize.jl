'use strict'
/*
    - most of the time is spent touching the dom. can we do less?
*/

function __v__initialize(env) {
    function apply(parent, chan) {
        // this function is called on a parent selection that has data bound to it.
        // the datum is of shape {"enterattrs": {}, "attrs": {}, "transitionattrs":{}, "tag": "linearGradient", "exitattrs":{}, "data": []}
        // or has html: "" rather than tag and data.
        if (!parent.size()) return

        // note: the selection must be of a single node — that's how this is set up.
        console.assert(parent.size() == 1)
        let datum = parent.datum()
        // A child should have at most one of html or data — both are ways of defining children.
        console.assert(!('data' in datum && 'html' in datum))

        // If data is defined, a tag must be defined
        console.assert(('data' in datum) == ('tag' in datum))

        if ('attrs' in datum) {
            parent.attrs(datum.attrs)
        }

        // If this is an element with heterogenous children, simply set the html content.
        if ('html' in datum) {
            parent.html(datum.html)
            return
        }

        let transit = sel => sel.transition(chan).duration(datum.duration || 450).ease(d3[datum.ease || 'easeCubic'])

        // todo: don't put empty transitionattrs on things in the jl
        // todo: don't call transit when we don't need to transition (both here and inside the if below)
        if ('transitionattrs' in datum) {
            transit(parent).attrs(datum.transitionattrs)
        }

        // Otherwise, do a data-join.
        if ('tag' in datum) {
            let tag = datum.tag
            let update = parent.selectAll(tag).data(d => d.data, function(d, i) {
                // Use data-key as the key for existing and incoming elements, or default to the data index.
                let key = (d && d.attrs) ? d.attrs['data-key'] : this.dataset.key
                return key !== undefined ? key : i
            })
            transit(update.attrs(d => d.attrs)).attrs(d => d.transitionattrs)
            // Don't transition "transitionattrs" on enter selections; they just got here. (but how do we fade in? enterattrs?)
            // todo: pick those d.attrs/d.transitionattrs that are also enterattrs and do stuff.
            let enter = update.enter().append(tag).attrs(d => d.attrs).attrs(d => d.transitionattrs)
            // Transition the enter attributes worth transitioning. By construction, enterattrs are a subset of transitionattrs.
            transit(enter.attrs(d => d.enterattrs)).attrs(d => {
                let o = {}
                Object.keys(d.enterattrs).forEach(k => o[k] = d.transitionattrs[k])
                return o
            })
            // Use the parent's exitattrs to transition on exit. This means all children exit in the same way.
            let leave = sel => transit(sel).attrs(datum.exitattrs).remove()
            let exit  = update.exit().call(leave)
            // Recurse into children for which we have data, and ensure that children of elements without data are exited cleanly.
            enter.merge(update).each(function(d) {
                if ('data' in d || 'html' in d) {
                    apply(d3.select(this))
                } else {
                    // Note: The case of e.g.
                    d3.selectAll(this.children).call(leave)
                }
            })
        }
    }

    // Store the default page for use when a hover-unhover occurs before a select.
    let defaultpage = {} // {book: page, ...}
    let setdefaults = sel => sel.each(function() {
        if (!(this.dataset.book in defaultpage)) {
            defaultpage[this.dataset.book] = this.dataset.page
        }
    })

    // Store the currently hovered and selected page per channel
    let select = {}, hover = {} // {chan: page, ...}

    function action(tokens, eventtype, peel) {
        // tokens = ["chan", "page", "chan", "page", ...]
        // eventtype = select or hover
        // peel = a function to pop a token, and return either the token or null, in the case of an unhover.
        while (tokens.length) {
            let chan = tokens.shift()
            let page = peel(tokens)
            eventtype[chan] = page
            let targetpage = (chan in hover && hover[chan] !== null) ? hover[chan] : select[chan]
            let sel = d3.selectAll(`[data-chan~=${chan}]`)
            while (sel.size()) {
                // turn to the hovered, selected, or default page
                sel = sel
                    // augment the default page dictionary with all default pages for books on this channel
                    .call(setdefaults)
                    // bind the data for the target page to this book
                    .datum(function() {
                        let book = this.dataset.book
                        return env[book][targetpage !== undefined ? targetpage : defaultpage[book]]
                    })
                    // turn to the new page
                    // .call(apply)
                    .each(function() { d3.select(this).call(apply, chan) })
                    // re-initialize event handlers inside of dynamic portions of the page
                    .call(init)
                    // recursively select any sub-books, and do it all again
                    // note: this was slow, so I disabled it for now.
                    // hypothesis: this was slow due to excessive nesting.
                    // .selectAll(`[data-chan=${chan}]`)

                // Select all children, simultaneously flattening the selection.
                // TODO: make sure we're not re-selecting the already updated nodes
                // sel = d3.select(d3.selectAll(`[data-chan~=${chan}]`).nodes())
                break
            }
        }
    }

    let init = sel => {
        // Respond to select events
        sel.selectAll('[data-select]').on('click', function() {
            action(this.dataset.select.split(" "), select, tokens => tokens.shift())
            d3.event.stopPropagation()
        })

        // Respond to hover events. The "peel" function returns null on unhover.
        let handleHover = function() {
            if ('hoverSelect' in this.dataset) {
                action(this.dataset.hoverSelect.split(" "), select, tokens => tokens.shift())
            }
            if ('hover' in this.dataset) {
                action(this.dataset.hover.split(" "), hover, tokens => tokens.shift())
            }
            d3.event.preventDefault() // prevent scrolling on mobile
        }

        let handleUnhover = function() {
            if ('unhoverSelect' in this.dataset) {
                action(this.dataset.unhoverSelect.split(" "), select, tokens => tokens.shift())
            }
            if ('hover' in this.dataset) {
                action(this.dataset.hover.split(" "), hover, tokens => (tokens.shift(), null))
            }
        }

        sel.selectAll("[data-hover], [data-hover-select], [data-unhover-select]")
            .on("mouseenter.hover", handleHover)
            .on("mouseleave.hover", handleUnhover)
            .on("touchstart.hover", handleHover)
            .on("touchend.hover",   handleUnhover)
    }

    init(d3)
};
