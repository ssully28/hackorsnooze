$(async function () {
  // cache some selectors we'll be using quite a bit
  const $allStoriesList = $("#all-articles-list");
  const $submitForm = $("#submit-form");
  const $filteredArticles = $("#filtered-articles");
  const $loginForm = $("#login-form");
  const $createAccountForm = $("#create-account-form");
  const $ownStories = $("#my-articles");
  const $navLogin = $("#nav-login");
  const $navLogOut = $("#nav-logout");
  const $userButtons = $("#user-buttons"); // For show/hiding all the logged in user buttons
  const $addNewStory = $("#addNewStory");
  const $showFavorites = $('#showFavorites');
  const $showOwnStories = $('#showOwnStories');

  let scrollCounter = 0; // Used to track our scroll counter to grab x (in our case 25) stories at a time

  // global storyList variable
  let storyList = null;
  let favoritesList = null;

  // global currentUser variable
  let currentUser = null;

  await checkIfLoggedIn();

  /**
   * Event listener for logging in.
   *  If successfully we will setup the user instance
   */
  $loginForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page-refresh on submit

    // grab the username and password
    const username = $("#login-username").val();
    const password = $("#login-password").val();

    // call the login static method to build a user instance
    const userInstance = await User.login(username, password);
    // set the global user to the user instance
    currentUser = userInstance;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Event listener for signing up.
   *  If successfully we will setup a new user instance
   */
  $createAccountForm.on("submit", async function (evt) {
    evt.preventDefault(); // no page refresh

    // grab the required fields
    let name = $("#create-account-name").val();
    let username = $("#create-account-username").val();
    let password = $("#create-account-password").val();

    // call the create method, which calls the API and then builds a new user instance
    const newUser = await User.create(username, password, name);
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
  });

  /**
   * Log Out Functionality
   */
  $navLogOut.on("click", function () {
    // empty out local storage
    localStorage.clear();
    // refresh the page, clearing memory
    location.reload();
  });

  /**
   * Event Handler for Clicking Login
   */
  $navLogin.on("click", function () {
    // Show the Login and Create Account Forms
    $loginForm.slideToggle();
    $createAccountForm.slideToggle();
    $allStoriesList.toggle();
  });

  /**
   * Event handler for Navigation to Homepage
   */
  $("body").on("click", "#nav-all", async function () {
    hideElements();
    await generateStories();
    if (currentUser){
      showNavForLoggedInUser();
    }
    $allStoriesList.show();
  });

  /**
   * Event handler for submit form to add new stories
   */
  $submitForm.on("submit", async function (evt) {
    evt.preventDefault();

    let newStoryObj = {
      author: $("#author").val(),
      title: $("#title").val(),
      url: $("#url").val(),
    }

    // Perform the post and away for the returned story
    let response = await storyList.addStory(currentUser, newStoryObj);

    // HTML'ify the return story object
    let htmlResponse = generateStoryHTML(response);

    // Prepend to the story list:
    $allStoriesList.prepend(htmlResponse);
  });

  /**
   * Event handler for add new story button (Shows new story form!)
   */
  $addNewStory.on("click", function () {
    $submitForm.toggle();
  });

  /* Favorites Event Delegation */
  $allStoriesList.on("click", ".fa-heart", async function (evt) {
    evt.preventDefault();

    if ($(this).hasClass('fas')) {

      // API CALL - Remove Favorite from user  & update our global
      currentUser.favorites = await currentUser.removeFavoriteToUser($(this).parent().attr("id"));
      // Toggle the heart light or dark
      $(this).removeClass('fas').addClass('far');

    }
    else {

      // API CALL - Add Favorite to user & update our global
      currentUser.favorites = await currentUser.addFavoriteToUser($(this).parent().attr("id"));
      // Toggle the heart light or dark
      $(this).removeClass('far').addClass('fas');

    }

  })

  /* Deletion event delegation */
  $allStoriesList.on("click", ".fa-trash-alt", async function () {
      
      let storyId = $(this).parent().attr("id");

      await currentUser.deleteStory(storyId); // Making an API call
      generateOwnStories(); // Rerendering own stories
  })

  /**
   * Event Handler for Show Favorites Button
   * 
   * TODO:  Refactor so when clicking "show favorites", if we're looking
   *        at "show own stories", that button gets reset to "show own stories"
   *        (currently it would continue to show "show all")
   * 
   *        vice-versa for show own stories!
   */
  $showFavorites.on("click", async function (evt) {
    evt.preventDefault();

    // Store button to a var for reuse:
    let $favButton = $(this).children(":first");

    // Need to toggle button (show favorites/show all)
    if ($favButton.text() === "Show Favorites") {
      // User clicked button and it was "Show Favorites" so toggle button to "Show All"
      $favButton.text("Show All");

      // 1) Empty the storyList div
      // 2) show all the favorites
      $allStoriesList.empty();
      generateFavorites();
      $(".fa-heart").show(); // Show the hearts because we're logged in

    }
    else {
      // User must have clicked button when it was "show all" to change button to "show favs"
      $favButton.text("Show Favorites");

      // 1) Empty the favorites
      // 2) Show the storyList div
      $allStoriesList.empty();
      await generateStories();
      $(".fa-heart").show(); // Show the hearts because we're logged in
    }

  });

  $showOwnStories.on("click", async function (evt) {
    evt.preventDefault();

    // Store button to a var for reuse:
    let $ownStoriesButton = $(this).children(":first");

    // Need to toggle button (show favorites/show all)
    if ($ownStoriesButton.text() === "Show Own Stories") {
      // User clicked button and it was "Show Favorites" so toggle button to "Show All"
      $ownStoriesButton.text("Show All");

      // 1) Empty the storyList div
      // 2) show all the favorites
      $allStoriesList.empty();
      generateOwnStories();
      $(".fa-heart").show(); // Show the hearts because we're logged in

    }
    else {
      // User must have clicked button when it was "show all" to change button to "show favs"
      $ownStoriesButton.text("Show Own Stories");

      // 1) Empty the favorites
      // 2) Show the storyList div
      $allStoriesList.empty();
      await generateStories();
      $(".fa-heart").show(); // Show the hearts because we're logged in
    }

  });

  /**
   * Event Listener on window to implement infinite-scroll
   * Checks document height against window hight to detect
   * bottom, then does an ajax call to grab the next 25
   * stories and appends those to the 'allStoriesList'
   */
  $(document).ready(function(){
    let win = $(window);

    win.scroll(async function(){
      if ($(document).height() - win.height() == win.scrollTop()) 
      {
        // User scrolled to the bottom of the screen, now we'll 
        // want to do an api call and get more stories and append
        // them to the story list:


        // Increase the scroll counter by 25 so we don't keep grabbing
        // the same articles over and over and over!
        scrollCounter += 25;

        
        // API call to grab next 25:
        let nextStoryList = await StoryList.getMoreStories(scrollCounter);
        //let nextStoryListHTML = generateStoryHTML(nextStoryList);


        // loop through all of our stories and generate HTML for them and append:
        for (let story of nextStoryList.stories) {
          const result = generateStoryHTML(story);
          $allStoriesList.append(result);
        }

      }
    })
  });
  
  
  /**
   * On page load, checks local storage to see if the user is already logged in.
   * Renders page information accordingly.
   */
  async function checkIfLoggedIn() {
    // let's see if we're logged in
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    
    // if there is a token in localStorage, call User.getLoggedInUser
    //  to get an instance of User with the right details
    //  this is designed to run once, on page load
    currentUser = await User.getLoggedInUser(token, username);
    await generateStories();
    
    if (currentUser) {
      showNavForLoggedInUser();
    }
  }
  
  /**
   * A rendering function to run to reset the forms and hide the login info
   */
  function loginAndSubmitForm() {
    // hide the forms for logging in and signing up
    $loginForm.hide();
    $createAccountForm.hide();
    
    // reset those forms
    $loginForm.trigger("reset");
    $createAccountForm.trigger("reset");
    
    // show the stories
    $allStoriesList.show();
    
    // update the navigation bar
    showNavForLoggedInUser();
    
    // Once we log in re-fresh page so our wonderful favorites show up!
    document.location.reload();
  }
  
  /**
   * A rendering function to call the StoryList.getStories static method,
   *  which will generate a storyListInstance. Then render it.
   */
  async function generateStories() {
    // get an instance of StoryList
    const storyListInstance = await StoryList.getStories();
    // update our global variable
    storyList = storyListInstance;
    // empty out that part of the page
    $allStoriesList.empty();
    
    // loop through all of our stories and generate HTML for them
    for (let story of storyList.stories) {
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }
  
  function generateFavorites() {
    
    // empty out that part of the page
    $allStoriesList.empty();
    
    // loop through all of our stories and generate HTML for them
    for (let story of currentUser.favorites.reverse()) { // Reverses to newest first, to oldest LIFO
      const result = generateStoryHTML(story);
      $allStoriesList.append(result);
    }
  }
  /**
   * Pull the own stories from the current User and displays them.
   */
  function generateOwnStories() {
     // empty out that part of the page
     $allStoriesList.empty();
    
     // loop through all of our stories and generate HTML for them
     for (let story of currentUser.ownStories.reverse()) { // Reverses to newest first, to oldest LIFO
       const result = generateStoryHTML(story, "ownersView"); // owner's view is a parameter flag
       $allStoriesList.append(result);
     }

  }
  /**
   * A function to render HTML for an individual Story instance.
   * option is optional flag which can be "ownersView"
   */
  function generateStoryHTML(story, option) {
    let hostName = getHostName(story.url);


    // Set a default heart class (non-favorite)
    let heartClass = "far";

    // If we have current user - then check if it hasFavorited this story:
    if (currentUser) {
      heartClass = currentUser.hasFavorited(story.storyId) ? "fas" : "far";
    }

    let trashHTML = "";
    if (option === "ownersView") { // find the owner through the story.owner or something Note
      trashHTML = '<i class="fas fa-trash-alt"></i>';
    }

    // render story markup
    const storyMarkup = $(`
      <li id="${story.storyId}">
        
        <i class="hidden ${heartClass} fa-heart"></i>
        <a class="article-link" href="${story.url}" target="a_blank">
          <strong>${story.title}</strong>
        </a>
        <small class="article-author">by ${story.author}</small>
        <small class="article-hostname ${hostName}">(${hostName})</small>
        ${trashHTML}
        <small class="article-username">posted by ${story.username}</small>
      </li>
    `);

    return storyMarkup;
  }

  // hide all elements in elementsArr
  function hideElements() {
    const elementsArr = [
      $submitForm,
      $allStoriesList,
      $filteredArticles,
      $ownStories,
      $loginForm,
      $createAccountForm
    ];
    elementsArr.forEach($elem => $elem.hide());
  }

  function showNavForLoggedInUser() {

    $navLogin.hide();
    $navLogOut.show();


    $userButtons.show();
    // // Only show the add new story button if logged in:
    // $addNewStory.show();

    // // Only show the favorites button if we're logged in:
    // $showFavorites.show();

    // Only show the likable hearts if logged in:
    $(".fa-heart").show();

  }

  // simple function to pull the hostname from a URL
  function getHostName(url) {
    let hostName;
    if (url.indexOf("://") > -1) {
      hostName = url.split("/")[2];
    } else {
      hostName = url.split("/")[0];
    }
    if (hostName.slice(0, 4) === "www.") {
      hostName = hostName.slice(4);
    }
    return hostName;
  }

  // sync current user information to localStorage
  function syncCurrentUserToLocalStorage() {
    if (currentUser) {
      localStorage.setItem("token", currentUser.loginToken);
      localStorage.setItem("username", currentUser.username);
    }
  }
});
