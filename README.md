[![NPM](https://nodei.co/npm/gist-client.png?downloads=true&stars=true)](https://nodei.co/npm/gist-client/)

Gist Client
==============

A client to consume [Gist](https://gist.github.com/) API with JS. Provides some features like filtering or abstraction of resource pagination. You don't know Gist? See [official Github's help](https://help.github.com/articles/about-gists/).

## Installation

<pre><code>$ npm install --save gist-client</code></pre>

### Get a Github token

Certain operations on Gist require authorization. Read more about how to get a granted token in ['About scopes for OAuth Apps'](https://developer.github.com/apps/building-integrations/setting-up-and-registering-oauth-apps/about-scopes-for-oauth-apps/).

## Basic use

To use Gist Client you need to require it and create an instance:

<pre><code>const GistClient = require("gist-client")
const gistClient = new GistClient()</code></pre>

If you want to get your private Gist or perform some securized operation, you need to use setToken method to bind your token:

<pre><code>gistClient.setToken('YOUR_TOKEN') //To bind token
gistClient.unsetToken() //To remove binded token</code></pre>

### Getting a Gist

Gist Client works with promises. For example, if you want to get a single Gist you do the following:

<pre><code>gistClient.getOneById('GIST_ID')
    .then(response => {
        console.log(response)
    }).catch(err => {
        console.log(err)
    })</code></pre>
    
You don't need a token to get a public Gist, but if you are trying to get a private one, you need to set the token. You can do:

<pre><code>gistClient.setToken('YOUR_TOKEN').getOneById('GIST_ID')</code></pre>

Or:

<pre><code>gistClient.setToken('YOUR_TOKEN')
gistClient.getOneById('GIST_ID')</code></pre>

## Get a Gist list

You can use getAll method to get a Gist list:

<pre><code>gistClient.setToken('YOUR_TOKEN').getAll() //List the authenticated user's gists
gistClient.getAll() //List all public gists (Max. 3000 -an API limitation-)</code></pre>

### Iterating the list

Results can be iterated without worrying about pagination:

<pre><code>gistClient.setToken('YOUR_TOKEN').getAll().then((gistList) => {
    gistList.forEach((gist) => {
        console.log(gist)
    })
})</code></pre>

### Filtering the list

Gist Client allows you to filter results. You can append filters, it will be applied with 'AND' criteria.

<pre><code>gistClient.setToken('YOUR_TOKEN').getAll({filterBy: [
    {public: true},
    {since: '2017-01-02T12:10:51Z'},
    {language: 'PHP'}
]})</code></pre>

This call will be return all user's public gists in PHP that have been updated since given date.

There is a limited list of filters that can be applied to a result:

| Filter | Tier | Type | Notes |
|-----------|----------|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| since | global | string | A timestamp in ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ. Only gists updated at or after this time are returned. |
| userName | resource | string | Name of the user whose documents you want to list. |
| starred | resource | bool | Starred gists. |
| public | resource | bool | Public gists. |
| size | file | int | File size in Kb. |
| raw_url | file | string | Url to file's raw content. |
| type | file | string | text/plain, application/json... |
| language | file | string | PHP, Javascript, Erlang, Java... |
| truncated | file | bool | The Gist API provides up to one megabyte of content for each file in the gist. Each file returned for a gist through the API has a key called truncated. If truncated is true, the file is too large and only a portion of the contents were returned in content. |
| content | file | string | File content. **IMPORTANT: You must to activate option rawContent to use this filter**. |

- **resource tier**: filters at API resource level. **You can't combine these filters types between them**; for example if you are using 'userName' you can't use 'starred' too.
- **file**: filters at the level of documents linked to gists. It will search for any gist that contains a file with the given criteria.
- **global tier**: Can be used in combination with any other.

### Bind raw content

Gist API hides the content of the files in lists to decrease payload. Gist Client provides an option to bind the content in list; rawContent (true|false). You can use it as follow:

<pre><code>gistClient.getAll({rawContent: true}) //false as default</code></pre>

**IMPORTANT: Be careful with the preceding call**. Using this option in combination with 'filterBy' is highly recommended to limit the total amount of requests to Gist API. Keep in mind that there were an aditional API call for each retrieved file. It can rebase your remaining rate limit on Github API.

## Get a gist revision

<pre><code>gistClient.setToken('YOUR_TOKEN').getRevision('GIST_ID', 'VERSION_SHA') //Returns a promise</code></pre>

## Get gist commits

<pre><code>gistClient.setToken('YOUR_TOKEN').getCommits('GIST_ID') //Returns a promise</code></pre>

## Get gist forks

<pre><code>gistClient.setToken('YOUR_TOKEN').getForks('GIST_ID') //Returns a promise</code></pre>

## Check if gist is starred

<pre><code>gistClient.setToken('YOUR_TOKEN').isStarred('GIST_ID') //Returns true if gist is starred</code></pre>

## Star / unstar gists

<pre><code>//These methods return true if operation is done
gistClient.setToken('YOUR_TOKEN').star('GIST_ID') //Mark a gist as starred
gistClient.setToken('YOUR_TOKEN').unstar('GIST_ID') //Mark a gist as unstarred</code></pre>

## Create / update gists

To create a new gist you can use 'create' method as follow:

<pre><code>gistClient.setToken('YOUR_TOKEN').create({
    "files": [{
        "x.txt": {
            "content": "xx"
        }
    }],
    "description": "desc",
    "public": true
}).then(newGist => {
    console.log(newGist)
})</code></pre>

To edit a gist you can use 'update' metod:

<pre><code>gistClient.setToken('YOUR_TOKEN').update('GIST_ID', {description: 'new description'})</code></pre>

## Delete a gist

<pre><code>gistClient.setToken('YOUR_TOKEN').delete('GIST_ID') //Returns true if gist has been removed</code></pre>

If you need information about Gist API, you can see [official documentation](https://developer.github.com/v3/gists/).
