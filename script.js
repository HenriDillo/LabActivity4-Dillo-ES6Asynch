const API_URL = "https://jsonplaceholder.typicode.com/posts";
const POSTS_PER_PAGE = 10;

const elements = {
  postList: document.querySelector("#postList"),
  postsRegion: document.querySelector("#postsRegion"),
  searchInput: document.querySelector("#searchInput"),
  authorFilter: document.querySelector("#authorFilter"),
  resultCount: document.querySelector("#resultCount"),
  refreshButton: document.querySelector("#refreshButton"),
  clearFiltersButton: document.querySelector("#clearFiltersButton"),
  emptyState: document.querySelector("#emptyState"),
  status: document.querySelector("#status"),
  pagination: document.querySelector("#pagination"),
  previousButton: document.querySelector("#previousButton"),
  nextButton: document.querySelector("#nextButton"),
  pageIndicator: document.querySelector("#pageIndicator"),
};

let state = {
  posts: [],
  searchTerm: "",
  selectedAuthor: "all",
  currentPage: 1,
  isLoading: false,
};

let activeRequestController;

const escapeHtml = (value = "") => {
  const text = document.createTextNode(String(value));
  const wrapper = document.createElement("div");
  wrapper.append(text);
  return wrapper.innerHTML;
};

const formatNumber = (number) => String(number).padStart(2, "0");

const getFilteredPosts = () => {
  const normalizedSearch = state.searchTerm.trim().toLowerCase();

  return state.posts.filter(({ title, body, userId }) => {
    const matchesSearch =
      normalizedSearch === "" ||
      [title, body].some((value) => value.toLowerCase().includes(normalizedSearch));
    const matchesAuthor =
      state.selectedAuthor === "all" || userId === Number(state.selectedAuthor);

    return matchesSearch && matchesAuthor;
  });
};

const getPageData = (posts) => {
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const safePage = Math.min(state.currentPage, totalPages);
  const startIndex = (safePage - 1) * POSTS_PER_PAGE;

  state = { ...state, currentPage: safePage };

  return {
    totalPages,
    visiblePosts: posts.slice(startIndex, startIndex + POSTS_PER_PAGE),
  };
};

const createPostMarkup = ({ id, title, body, userId }, index) => `
  <li class="post-item" style="--item-index: ${index}">
    <span class="post-number" aria-label="Post ${id}">${formatNumber(id)}</span>
    <h2 class="post-title">${escapeHtml(title)}</h2>
    <p class="post-preview">${escapeHtml(body)}</p>
    <p class="post-author">Author ${formatNumber(userId)}</p>
  </li>
`;

const renderSkeletons = () => {
  elements.postList.innerHTML = Array.from(
    { length: POSTS_PER_PAGE },
    (_, index) => `
      <li class="post-item" style="--item-index: ${index}" aria-hidden="true">
        <span class="skeleton skeleton--number"></span>
        <span class="skeleton skeleton--title"></span>
        <span class="skeleton skeleton--preview"></span>
        <span class="skeleton skeleton--author"></span>
      </li>
    `,
  ).join("");
};

const renderPagination = (totalPages) => {
  const hasMultiplePages = totalPages > 1;

  elements.pagination.hidden = !hasMultiplePages;
  elements.previousButton.disabled = state.currentPage === 1;
  elements.nextButton.disabled = state.currentPage === totalPages;
  elements.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
};

const renderPosts = () => {
  const filteredPosts = getFilteredPosts();
  const { visiblePosts, totalPages } = getPageData(filteredPosts);
  const resultLabel = filteredPosts.length === 1 ? "result" : "results";

  elements.resultCount.textContent = `${filteredPosts.length} ${resultLabel}`;
  elements.postList.innerHTML = visiblePosts.map(createPostMarkup).join("");
  elements.postsRegion.hidden = filteredPosts.length === 0;
  elements.emptyState.hidden = filteredPosts.length > 0;
  renderPagination(totalPages);
};

const populateAuthorFilter = (posts) => {
  const authorIds = [...new Set(posts.map(({ userId }) => userId))].sort((a, b) => a - b);
  const authorOptions = authorIds
    .map((userId) => `<option value="${userId}">Author ${formatNumber(userId)}</option>`)
    .join("");

  elements.authorFilter.innerHTML = `<option value="all">All authors</option>${authorOptions}`;
  elements.authorFilter.value = state.selectedAuthor;
};

const showStatus = ({ title, message, type = "info", retry = false }) => {
  elements.status.className = `status is-visible${type === "error" ? " is-error" : ""}`;
  elements.status.innerHTML = `
    <p><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</p>
    ${retry ? '<button class="button button--secondary" id="retryButton" type="button">Retry</button>' : ""}
  `;

  if (retry) {
    document.querySelector("#retryButton").addEventListener("click", fetchPosts);
  }
};

const hideStatus = () => {
  elements.status.className = "status";
  elements.status.replaceChildren();
};

const setLoadingState = (isLoading) => {
  state = { ...state, isLoading };
  elements.postsRegion.setAttribute("aria-busy", String(isLoading));
  elements.refreshButton.disabled = isLoading;
  elements.refreshButton.classList.toggle("is-loading", isLoading);

  if (isLoading) {
    showStatus({
      title: "Loading posts…",
      message: "Fetching fresh data asynchronously from JSONPlaceholder /posts.",
    });
    elements.postsRegion.hidden = false;
    elements.emptyState.hidden = true;
    elements.pagination.hidden = true;
    renderSkeletons();
  }
};

const fetchPosts = async () => {
  activeRequestController?.abort();
  activeRequestController = new AbortController();
  setLoadingState(true);

  try {
    const response = await fetch(API_URL, {
      signal: activeRequestController.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}.`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new TypeError("The API returned an unexpected response.");
    }

    const posts = data.map(({ userId, id, title, body }) => ({ userId, id, title, body }));
    state = { ...state, posts, currentPage: 1 };
    populateAuthorFilter(posts);
    hideStatus();
    renderPosts();
  } catch (error) {
    if (error.name === "AbortError") return;

    state = { ...state, posts: [] };
    elements.postList.replaceChildren();
    elements.postsRegion.hidden = true;
    elements.pagination.hidden = true;
    elements.resultCount.textContent = "0 results";
    showStatus({
      title: "Failed to load posts.",
      message: `${error.message} Check your connection and try again.`,
      type: "error",
      retry: true,
    });
  } finally {
    setLoadingState(false);
  }
};

const updateFilters = ({ searchTerm = state.searchTerm, selectedAuthor = state.selectedAuthor }) => {
  state = { ...state, searchTerm, selectedAuthor, currentPage: 1 };
  renderPosts();
};

elements.searchInput.addEventListener("input", ({ target: { value } }) => {
  updateFilters({ searchTerm: value });
});

elements.authorFilter.addEventListener("change", ({ target: { value } }) => {
  updateFilters({ selectedAuthor: value });
});

elements.clearFiltersButton.addEventListener("click", () => {
  elements.searchInput.value = "";
  elements.authorFilter.value = "all";
  updateFilters({ searchTerm: "", selectedAuthor: "all" });
  elements.searchInput.focus();
});

elements.refreshButton.addEventListener("click", fetchPosts);

elements.previousButton.addEventListener("click", () => {
  state = { ...state, currentPage: Math.max(1, state.currentPage - 1) };
  renderPosts();
  elements.postsRegion.scrollIntoView({ behavior: "smooth", block: "start" });
});

elements.nextButton.addEventListener("click", () => {
  state = { ...state, currentPage: state.currentPage + 1 };
  renderPosts();
  elements.postsRegion.scrollIntoView({ behavior: "smooth", block: "start" });
});

fetchPosts();
