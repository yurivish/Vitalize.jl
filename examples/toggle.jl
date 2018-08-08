# using Hyperscript, Vitalize

using Hyperscript
# The next two lines are a temporary work-around for
# some issues I've encountered with the package manager.
include("../src/Vitalize.jl")
using .Vitalize

@tags html head style body div
@tags_noescape script

variations = [div.red.page("page 1"), div.blue.page("page 2")]
pages, json = book("toggle", variations)

savehtml("toggle.html", html(
    head(
        # Include Vitalize libraries
        script(src="../src/d3.js"),
        script(src="../src/d3-selection-multi.js"),
        script(src="../src/Vitalize.js"),

        # Basic page styles
        style(
        css(".page", width=100px, height=100px),
            css(".red",  background="red"),
            css(".blue", background="blue"),
        ),
    ),
    body(
        # Show the first page
        first(pages),

        # Buttons for interactive toggling
        div.button(dataSelect="toggle 1", "Page One"),
        div.button(dataSelect="toggle 2", "Page Two"),

        # Include the vitalize script for interactivity
        js(json),
    )
))
