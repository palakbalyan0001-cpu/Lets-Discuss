import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import * as wsApi from "../api/workspaces"
import { getErrorMessage } from "../api/axios"

export const fetchWorkspaces = createAsyncThunk("workspaces/fetch", async (_, { rejectWithValue }) => {
    try { return (await wsApi.getMyWorkspaces()).data.data } catch (e) { return rejectWithValue(getErrorMessage(e)) }
})
export const createWorkspace = createAsyncThunk("workspaces/create", async (data, { rejectWithValue }) => {
    try { return (await wsApi.createWorkspaces(data)).data } catch (e) { return rejectWithValue(getErrorMessage(e)) }
})
export const deleteWorkspace = createAsyncThunk("workspaces/delete", async (id, { rejectWithValue }) => {
    try { await wsApi.deleteWorkspace(id); return id } catch (e) { return rejectWithValue(getErrorMessage(e)) }
})
export const leaveWorkspace = createAsyncThunk("workspaces/leave", async (id, { rejectWithValue }) => {
    try { await wsApi.leaveWorkspace(id); return id } catch (e) { return rejectWithValue(getErrorMessage(e)) }
})

const slice = createSlice({
    name: "workspaces",
    initialState: { list: [], loading: false, error: null },
    reducers: {
        clearWorkspaceError(state) { state.error = null },
        resetWorkspaces(state) { state.list = []; state.error = null },
    },
    extraReducers: (builder) => {
        const remove = (s, a) => { s.list = s.list.filter((w) => w._id !== a.payload) }
        builder
            .addCase(fetchWorkspaces.pending, (s) => { s.loading = true; s.error = null })
            .addCase(fetchWorkspaces.fulfilled, (s, a) => { s.loading = false; s.list = a.payload })
            .addCase(fetchWorkspaces.rejected, (s, a) => { s.loading = false; s.error = a.payload })
            .addCase(deleteWorkspace.fulfilled, remove)
            .addCase(leaveWorkspace.fulfilled, remove)
            .addCase(deleteWorkspace.rejected, (s, a) => { s.error = a.payload })
            .addCase(leaveWorkspace.rejected, (s, a) => { s.error = a.payload })
    },
})

export const { clearWorkspaceError, resetWorkspaces } = slice.actions
// "Created by me" vs "I'm a member of"
export const selectCreated = (state) => state.workspaces.list.filter((w) => w.isOwner)
export const selectJoined = (state) => state.workspaces.list.filter((w) => !w.isOwner)
export default slice.reducer
