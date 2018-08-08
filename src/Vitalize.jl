module Vitalize

# using Hyperscript
# @edit m("hi")

import JSON
using Hyperscript: m, render, tag, attrs, children, AbstractNode, Node, DOM, @tags, @tags_noescape
using Base.Iterators
export book, book!, Vitalizer, js

allequal(xs) = isempty(xs) || all(==(first(xs)), xs)

# takes an array of dom children and checks whether they are all nodes with an equal tag
allhomogenous(cs) = all(c -> c isa AbstractNode, cs) && allequal(map(tag, cs))

allchildren(nodes) = flatten(children(node) for node in nodes)

function shouldtransition((attr, value))
    attr in ["id", "class"] && return false
    startswith(attr, "data-") && return false
    true
end

const enter_exit_attrs = Dict("opacity" => 0, "stop-opacity" => 0)

function data(cs; transition, duration, ease, enterattrs=enter_exit_attrs, exitattrs=enter_exit_attrs)
    # Enforce identical tag names across children
    @assert allequal(tag.(cs)) "All child elements must be of equal type: $(tag.(cs))"
    # Enforce identical attribute names across children
    # todo: print a diff.
    # `string` to work around #26881:
    @assert allequal(keys.(attrs.(cs))) "All child elements must have the same attribute names: $(join(string.(keys.(attrs.(cs))), ", "))"

    # homogenous means "has children and they are all the same type and tag
    all_children_of_all_nodes = allchildren(cs)

    homogenous = !isempty(all_children_of_all_nodes) && allhomogenous(all_children_of_all_nodes)
    # html means that all children should have their content set as html
    html = !homogenous && !isempty(all_children_of_all_nodes)

    map(cs) do c
        datum = Dict()
        transitionattrs = transition ? filter(shouldtransition, attrs(c)) : Dict()
        otherattrs = transition ? filter(!shouldtransition, attrs(c)) : attrs(c)
        if transition
            datum[:duration] = duration
            datum[:ease] = ease
        end

        datum[:exitattrs]  = Dict(k => v for (k, v) in exitattrs  if haskey(transitionattrs, k))
        datum[:enterattrs] = Dict(k => v for (k, v) in enterattrs if haskey(transitionattrs, k))

        if !isempty(attrs(c))
            datum[:attrs] = otherattrs
            datum[:transitionattrs] = transitionattrs
        end

        subs = children(c)

        if homogenous
            empty = isempty(subs)
            datum[:tag]  = tag(first(all_children_of_all_nodes))
            datum[:data] = data(subs; enterattrs=enterattrs, exitattrs=exitattrs, transition=transition, ease=ease, duration=duration)
        elseif html
            datum[:html] = join(subs)
        end

        datum
    end
end

function book(bookid, nodes; transition=false, ease=:easeCubic, duration=450, channel=bookid) # todo: maybe no default value for channel?
    @assert !isempty(nodes)
    pages = map(enumerate(nodes)) do (i, node)
        disallowed = channel == nothing ? ("data-book", "data-page") : ("data-chan", "data-book", "data-page")
        @assert !any(haskey.(Ref(attrs(node)), disallowed))
        # The channel is currently treated the same as other attributes, and gets set by the book.
        # If we want to _not_ dynamically set the channel on book updates, pass `nothing`.
        # This allows multiple copies of the same page of the same book to subscribe to independent channels.
        # (Useful e.g. for the circle-letter highlighting on the Vitalize baby names example.)
        if channel == nothing
            node(dataBook=bookid, dataPage=i)
        else
            node(dataBook=bookid, dataPage=i, dataChan=channel)
        end
    end
    pageids = getindex.(attrs.(pages), Ref("data-page"))
    pages, Dict(bookid => Dict(zip(pageids, data(pages, transition=transition, ease=ease, duration=duration))))
end

@tags_noescape script

function js(dicts::Dict...)
    # todo: can we have an assert that each book has a unique ID? sum(length.(dicts)) ==
    # note: this needs to be callable multiple times -- include eg. d3 separately & in the head of the page.
    isempty(dicts) && error("Attempting to generate JS without JSON data.") # return script() # todo: should this perhaps not error?

    script(
        # TODO: Figure out the least obtrusive way to get the libraries
        # on to the client page.
        # read(joinpath(@__DIR__, "d3.js"), String),
        # "\n",
        # read(joinpath(@__DIR__, "d3-selection-multi.js"), String),
        # "\n",
        # read(joinpath(@__DIR__, "Vitalize.js"), String),
        # "\n",
        "__v__initialize($(JSON.json(merge(dicts...))));\n"
    )
end

struct Vitalizer
    jsons::Vector
    Vitalizer() = new([])
end
function book!(v::Vitalizer, args...; kwargs...)
    pages, json = book(args...; kwargs...)
    push!(v.jsons, json)
    pages
end
js(v::Vitalizer) = js(v.jsons...)


end

#=
    thoughts
        can we do anything with order, e.g. use keys to enforce dom order?
        what can we do with small but nonhomogenous cases, e.g. <circle> followed by <text>?

=#